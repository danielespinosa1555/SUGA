require('dotenv').config();
const { pool } = require('./database');
const bcrypt = require('bcryptjs');

const seed = async () => {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding SUGA database...');
    await client.query('BEGIN');

    // Clear existing data (in order due to FK constraints)
    await client.query('DELETE FROM notifications');
    await client.query('DELETE FROM justifications');
    await client.query('DELETE FROM attendance');
    await client.query('DELETE FROM sessions');
    await client.query('DELETE FROM users');
    await client.query('DELETE FROM organizations');

    // ORGANIZATION
    const orgResult = await client.query(`
      INSERT INTO organizations (name, slug, email, threshold)
      VALUES ('TechCorp S.A.S.', 'techcorp', 'admin@techcorp.com', 75)
      RETURNING id
    `);
    const orgId = orgResult.rows[0].id;
    console.log('✅ Organization created');

    // USERS
    const passwordHash = await bcrypt.hash('demo1234', 12);
    const usersData = [
      { first: 'Ana', last: 'García', email: 'admin@suga.app', role: 'admin', group: 'Management' },
      { first: 'Carlos', last: 'Mendoza', email: 'carlos@corp.com', role: 'member', group: 'Dev' },
      { first: 'Lucia', last: 'Torres', email: 'lucia@corp.com', role: 'member', group: 'Design' },
      { first: 'Jorge', last: 'Ramírez', email: 'jorge@corp.com', role: 'member', group: 'Dev' },
      { first: 'Valentina', last: 'Cruz', email: 'valen@corp.com', role: 'member', group: 'QA' },
      { first: 'Andrés', last: 'Gómez', email: 'andres@corp.com', role: 'member', group: 'Dev' },
      { first: 'Sofía', last: 'Herrera', email: 'sofia@corp.com', role: 'member', group: 'Management' },
      { first: 'Mateo', last: 'Vargas', email: 'mateo@corp.com', role: 'member', group: 'QA' },
      { first: 'Isabela', last: 'Díaz', email: 'isabela@corp.com', role: 'member', group: 'Design' },
    ];

    const userIds = [];
    for (const u of usersData) {
      const r = await client.query(`
        INSERT INTO users (organization_id, first_name, last_name, email, password_hash, role, group_name)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [orgId, u.first, u.last, u.email, passwordHash, u.role, u.group]);
      userIds.push(r.rows[0].id);
    }
    console.log(`✅ ${userIds.length} users created`);

    // SESSIONS
    const sessionsData = [
      { title: 'Reunión de equipo Q2', date: '2026-03-10', group: 'Dev' },
      { title: 'Sprint Planning #5', date: '2026-03-17', group: 'Dev' },
      { title: 'Retrospectiva Q1', date: '2026-03-24', group: 'Todos' },
      { title: 'Daily Standup', date: '2026-03-31', group: 'Dev' },
      { title: 'Sprint Review', date: '2026-04-01', group: 'Dev' },
      { title: 'Diseño de arquitectura', date: '2026-04-03', group: 'Dev' },
      { title: 'Reunión con clientes', date: '2026-04-07', group: 'Management' },
      { title: 'Retrospectiva mensual', date: '2026-04-08', group: 'Todos' },
      { title: 'Daily Standup', date: '2026-04-09', group: 'Dev' },
    ];

    const sessionIds = [];
    for (const s of sessionsData) {
      const r = await client.query(`
        INSERT INTO sessions (organization_id, created_by, title, session_date, group_name)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [orgId, userIds[0], s.title, s.date, s.group]);
      sessionIds.push(r.rows[0].id);
    }
    console.log(`✅ ${sessionIds.length} sessions created`);

    // ATTENDANCE - realistic distribution
    const memberIds = userIds.slice(1); // skip admin
    const attendancePatterns = [
      // carlos: 91%
      [1,1,1,1,1,1,1,0,1],
      // lucia: 67%
      [1,0,1,0,1,0,1,0,1],
      // jorge: 83%
      [1,1,1,1,0,1,1,1,0],
      // valentina: 100%
      [1,1,1,1,1,1,1,1,1],
      // andres: 58%
      [1,0,0,1,0,1,0,1,0],
      // sofia: 95%
      [1,1,1,1,1,1,1,1,0],
      // mateo: 75%
      [1,0,1,1,0,1,1,0,1],
      // isabela: 88%
      [1,1,1,0,1,1,1,1,0],
    ];

    for (let ui = 0; ui < memberIds.length; ui++) {
      for (let si = 0; si < sessionIds.length; si++) {
        const present = attendancePatterns[ui]?.[si] === 1;
        await client.query(`
          INSERT INTO attendance (session_id, user_id, status, recorded_by)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (session_id, user_id) DO NOTHING
        `, [sessionIds[si], memberIds[ui], present ? 'present' : 'absent', userIds[0]]);
      }
    }
    console.log('✅ Attendance records created');

    // JUSTIFICATIONS
    const justData = [
      { userIdx: 1, sessIdx: 7, reason: 'Cita médica urgente', status: 'pending', file: 'certificado_medico.pdf' },
      { userIdx: 4, sessIdx: 1, reason: 'Capacitación externa', status: 'review', file: 'constancia_curso.pdf' },
      { userIdx: 6, sessIdx: 8, reason: 'Licencia de maternidad', status: 'pending', file: 'licencia.pdf' },
      { userIdx: 0, sessIdx: 3, reason: 'Viaje de trabajo', status: 'approved', file: 'tiquete.jpg' },
      { userIdx: 2, sessIdx: 5, reason: 'Emergencia familiar', status: 'rejected', file: 'carta.pdf' },
    ];

    for (const j of justData) {
      const attResult = await client.query(
        `SELECT id FROM attendance WHERE session_id = $1 AND user_id = $2`,
        [sessionIds[j.sessIdx], memberIds[j.userIdx]]
      );
      if (attResult.rows.length > 0) {
        await client.query(`
          INSERT INTO justifications (attendance_id, user_id, session_id, reason, file_name, file_type, status, reviewed_by, review_comment)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          attResult.rows[0].id,
          memberIds[j.userIdx],
          sessionIds[j.sessIdx],
          j.reason,
          j.file,
          j.file.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
          j.status,
          j.status === 'approved' || j.status === 'rejected' ? userIds[0] : null,
          j.status === 'rejected' ? 'Documento ilegible, por favor reenvíe con mejor calidad' : null,
        ]);
      }
    }
    console.log('✅ Justifications created');

    // NOTIFICATIONS
    const notifs = [
      { userId: memberIds[1], type: 'alert', title: 'Asistencia baja', message: 'Tu asistencia está por debajo del umbral mínimo (75%). Actual: 67%' },
      { userId: memberIds[4], type: 'alert', title: 'Asistencia baja', message: 'Tu asistencia está por debajo del umbral mínimo (75%). Actual: 58%' },
      { userId: userIds[0], type: 'justification', title: 'Nueva justificación', message: 'Lucia Torres envió una justificación para revisión' },
      { userId: userIds[0], type: 'justification', title: 'Nueva justificación', message: 'Andrés Gómez envió una justificación para revisión' },
    ];

    for (const n of notifs) {
      await client.query(`
        INSERT INTO notifications (user_id, type, title, message)
        VALUES ($1, $2, $3, $4)
      `, [n.userId, n.type, n.title, n.message]);
    }
    console.log('✅ Notifications created');

    await client.query('COMMIT');
    console.log('\n🎉 Seed completed!');
    console.log('📧 Admin login: admin@suga.app / demo1234');
    console.log('📧 Member login: carlos@corp.com / demo1234');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

seed().catch(console.error);
