const { query } = require('./database');

async function syncSchema() {
  const run = async (label, sql) => {
    try {
      await query(sql);
      console.log(`  [dbSync] ✅ ${label}`);
    } catch (err) {
      console.error(`  [dbSync] ❌ ${label}: ${err.message}`);
    }
  };

  await run('password_reset_tokens', `
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used       BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await run('justifications', `
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

  await run('justification_messages', `
    CREATE TABLE IF NOT EXISTS justification_messages (
      id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      justification_id  UUID NOT NULL REFERENCES justifications(id) ON DELETE CASCADE,
      sender_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message           TEXT NOT NULL,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await run('idx_jmsg_just', `
    CREATE INDEX IF NOT EXISTS idx_jmsg_just ON justification_messages(justification_id)
  `);
}

module.exports = { syncSchema };