require('dotenv').config();
const { pool } = require('./database');

const migrate = async () => {
  const client = await pool.connect();
  try {
    console.log('🚀 Starting SUGA migration...');
    await client.query('BEGIN');

    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ── ORGANIZATIONS ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name       VARCHAR(255) NOT NULL,
        slug       VARCHAR(120) UNIQUE NOT NULL,
        email      VARCHAR(255),
        logo_url   TEXT,
        threshold  INTEGER DEFAULT 75 CHECK (threshold BETWEEN 1 AND 100),
        settings   JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── USERS ────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
        first_name          VARCHAR(100) NOT NULL,
        last_name           VARCHAR(100) NOT NULL,
        email               VARCHAR(255) UNIQUE NOT NULL,
        password_hash       VARCHAR(255),
        role                VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin','member')),
        group_name          VARCHAR(100),
        avatar_url          TEXT,
        google_id           VARCHAR(255) UNIQUE,
        is_active           BOOLEAN DEFAULT true,
        two_factor_secret   VARCHAR(255),
        two_factor_enabled  BOOLEAN DEFAULT false,
        last_login          TIMESTAMPTZ,
        created_at          TIMESTAMPTZ DEFAULT NOW(),
        updated_at          TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── SESSIONS ─────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        created_by      UUID REFERENCES users(id),
        title           VARCHAR(255) NOT NULL,
        description     TEXT,
        session_date    DATE NOT NULL,
        start_time      TIME,
        end_time        TIME,
        group_name      VARCHAR(100) DEFAULT 'General',
        location        VARCHAR(255),
        is_active       BOOLEAN DEFAULT true,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── ADD MISSING COLUMNS (safe for existing databases) ───────────────────
    // These ALTER TABLE statements are idempotent — they check IF NOT EXISTS
    const alterStatements = [
      `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS location VARCHAR(255)`,
      `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS start_time TIME`,
      `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS end_time TIME`,
      `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS description TEXT`,
      `ALTER TABLE users    ADD COLUMN IF NOT EXISTS two_factor_secret  VARCHAR(255)`,
      `ALTER TABLE users    ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false`,
      `ALTER TABLE users    ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ`,
      `ALTER TABLE users    ADD COLUMN IF NOT EXISTS google_id  VARCHAR(255)`,
      `ALTER TABLE users    ADD COLUMN IF NOT EXISTS avatar_url TEXT`,
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS threshold  INTEGER DEFAULT 75`,
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS invite_code VARCHAR(12) UNIQUE`,
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'`,
      `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT`,
    ];
    for (const sql of alterStatements) {
      await client.query(sql);
    }

    // ── ATTENDANCE ───────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        session_id  UUID REFERENCES sessions(id) ON DELETE CASCADE,
        user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
        status      VARCHAR(20) DEFAULT 'absent'
                      CHECK (status IN ('present','absent','justified','late')),
        recorded_by UUID REFERENCES users(id),
        notes       TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (session_id, user_id)
      )
    `);

    // ── JUSTIFICATIONS ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS justifications (
        id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        attendance_id  UUID REFERENCES attendance(id) ON DELETE CASCADE,
        user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
        session_id     UUID REFERENCES sessions(id) ON DELETE CASCADE,
        reason         TEXT NOT NULL,
        file_url       TEXT,
        file_name      VARCHAR(255),
        file_size      INTEGER,
        file_type      VARCHAR(80),
        status         VARCHAR(20) DEFAULT 'pending'
                         CHECK (status IN ('pending','review','approved','rejected')),
        reviewed_by    UUID REFERENCES users(id),
        review_comment TEXT,
        reviewed_at    TIMESTAMPTZ,
        submitted_at   TIMESTAMPTZ DEFAULT NOW(),
        created_at     TIMESTAMPTZ DEFAULT NOW(),
        updated_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── PASSWORD RESET ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
        token      VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used       BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── NOTIFICATIONS ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
        type       VARCHAR(60) NOT NULL,
        title      VARCHAR(255) NOT NULL,
        message    TEXT,
        read       BOOLEAN DEFAULT false,
        data       JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── INDEXES ──────────────────────────────────────────────────────────────
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_att_session    ON attendance(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_att_user       ON attendance(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_sess_org       ON sessions(organization_id)',
      'CREATE INDEX IF NOT EXISTS idx_sess_date      ON sessions(session_date)',
      'CREATE INDEX IF NOT EXISTS idx_just_user      ON justifications(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_just_status    ON justifications(status)',
      'CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_users_org      ON users(organization_id)',
      'CREATE INDEX IF NOT EXISTS idx_notif_user     ON notifications(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_notif_read     ON notifications(user_id, read)',
    ];
    for (const idx of indexes) await client.query(idx);

    // ── updated_at TRIGGER ───────────────────────────────────────────────────
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
      $$ LANGUAGE plpgsql
    `);
    for (const t of ['organizations','users','sessions','attendance','justifications']) {
      await client.query(`DROP TRIGGER IF EXISTS trg_${t}_upd ON ${t}`);
      await client.query(`
        CREATE TRIGGER trg_${t}_upd
          BEFORE UPDATE ON ${t}
          FOR EACH ROW EXECUTE FUNCTION update_updated_at()
      `);
    }

    // ── ATTENDANCE SUMMARY VIEW ──────────────────────────────────────────────
    await client.query(`
      CREATE OR REPLACE VIEW v_attendance_summary AS
      SELECT
        u.id AS user_id,
        u.first_name, u.last_name, u.email, u.group_name, u.role,
        u.organization_id,
        COUNT(DISTINCT s.id) AS total_sessions,
        COUNT(a.id) FILTER (WHERE a.status = 'present')   AS total_present,
        COUNT(a.id) FILTER (WHERE a.status = 'absent')    AS total_absent,
        COUNT(a.id) FILTER (WHERE a.status = 'late')      AS total_late,
        COUNT(a.id) FILTER (WHERE a.status = 'justified') AS total_justified,
        CASE
          WHEN COUNT(DISTINCT s.id) = 0 THEN 0
          ELSE ROUND(
            COUNT(a.id) FILTER (WHERE a.status IN ('present','justified','late'))::NUMERIC
            / COUNT(DISTINCT s.id)::NUMERIC * 100, 2)
        END AS attendance_pct
      FROM users u
      LEFT JOIN sessions    s ON s.organization_id = u.organization_id AND s.is_active = true
      LEFT JOIN attendance  a ON a.session_id = s.id AND a.user_id = u.id
      WHERE u.is_active = true
      GROUP BY u.id, u.first_name, u.last_name, u.email, u.group_name, u.role, u.organization_id
    `);

    await client.query('COMMIT');
    console.log('✅ Migration complete — all tables, indexes and views are up to date');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

migrate().catch(console.error);

// This function is called separately - append these tables to your DB creation
/*
CREATE TABLE IF NOT EXISTS justification_messages (
  id           SERIAL PRIMARY KEY,
  justification_id INT NOT NULL REFERENCES justifications(id) ON DELETE CASCADE,
  sender_id    INT NOT NULL REFERENCES users(id),
  message      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jmsg_just ON justification_messages(justification_id);
*/
