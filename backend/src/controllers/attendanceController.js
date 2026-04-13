const { query } = require('../config/database');
const mailer = require('../config/mailer');

// POST /api/attendance/bulk
const saveBulkAttendance = async (req, res, next) => {
  try {
    const { sessionId, records } = req.body;
    if (!sessionId || !Array.isArray(records) || records.length === 0)
      return res.status(400).json({ error: 'sessionId y records son requeridos' });

    const orgId = req.user.organization_id;
    const session = await query('SELECT id FROM sessions WHERE id=$1 AND organization_id=$2', [sessionId, orgId]);
    if (!session.rows[0]) return res.status(404).json({ error: 'Sesión no encontrada' });

    for (const record of records) {
      if (!['present','absent','late','justified'].includes(record.status)) continue;
      await query(`
        INSERT INTO attendance (session_id,user_id,status,recorded_by,notes)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (session_id,user_id)
        DO UPDATE SET status=EXCLUDED.status, recorded_by=EXCLUDED.recorded_by, notes=EXCLUDED.notes
      `, [sessionId, record.userId, record.status, req.user.id, record.notes || null]);
    }

    // Check threshold and send alerts (email + in-app) — once per user per day
    const org = await query('SELECT threshold, name FROM organizations WHERE id=$1', [orgId]);
    const threshold = org.rows[0]?.threshold || 75;
    const orgName   = org.rows[0]?.name || 'SUGA';

    const atRisk = await query(`
      SELECT user_id, first_name, last_name, email, attendance_pct
      FROM v_attendance_summary
      WHERE organization_id=$1 AND attendance_pct < $2 AND role='member'
    `, [orgId, threshold]);

    for (const u of atRisk.rows) {
      // In-app notification: one per day per user
      const alreadyNotified = await query(`
        SELECT id FROM notifications
        WHERE user_id=$1 AND type='risk_alert' AND created_at > NOW() - INTERVAL '24 hours'
      `, [u.user_id]);

      if (!alreadyNotified.rows[0]) {
        await query(`
          INSERT INTO notifications (user_id,type,title,message)
          VALUES ($1,'risk_alert','⚠ Asistencia baja',$2)
        `, [u.user_id,
            `Tu asistencia es ${parseFloat(u.attendance_pct).toFixed(1)}%, por debajo del mínimo (${threshold}%)`]);

        const { subject, html } = mailer.templates.attendanceAlert({
          memberName: `${u.first_name} ${u.last_name}`,
          pct: parseFloat(u.attendance_pct),
          threshold,
          orgName,
        });
        await mailer.send({ to: u.email, subject, html });
      }
    }

    res.json({ message: 'Asistencia guardada correctamente', saved: records.length });
  } catch (err) { next(err); }
};

// PATCH /api/attendance/:id
const updateAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    if (!['present','absent','late','justified'].includes(status))
      return res.status(400).json({ error: 'Estado inválido' });
    const result = await query(
      'UPDATE attendance SET status=$1,notes=$2,recorded_by=$3 WHERE id=$4 RETURNING *',
      [status, notes, req.user.id, id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json({ attendance: result.rows[0] });
  } catch (err) { next(err); }
};

// GET /api/attendance/summary
const getAttendanceSummary = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { group } = req.query;
    let sql = 'SELECT * FROM v_attendance_summary WHERE organization_id=$1';
    const params = [orgId];
    if (group) { sql += ' AND group_name=$2'; params.push(group); }
    sql += ' ORDER BY attendance_pct ASC';
    const result = await query(sql, params);
    const org = await query('SELECT threshold FROM organizations WHERE id=$1', [orgId]);
    const threshold = org.rows[0]?.threshold || 75;
    res.json({
      users: result.rows.map(u => ({ ...u, isAtRisk: parseFloat(u.attendance_pct) < threshold })),
      threshold,
    });
  } catch (err) { next(err); }
};

// GET /api/attendance/user/:userId
const getUserAttendance = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const orgId = req.user.organization_id;
    if (req.user.role === 'member' && req.user.id !== userId)
      return res.status(403).json({ error: 'Sin acceso' });

    const [history, summary] = await Promise.all([
      query(`
        SELECT
          s.id AS session_id, s.title, s.session_date, s.group_name, s.location,
          COALESCE(a.status,'absent') AS status,
          a.id AS attendance_id, a.notes,
          j.id AS justification_id, j.status AS justification_status, j.reason,
          j.review_comment, j.reviewed_at
        FROM sessions s
        LEFT JOIN attendance a ON a.session_id=s.id AND a.user_id=$1
        LEFT JOIN justifications j ON j.session_id=s.id AND j.user_id=$1 AND j.status!='rejected'
        WHERE s.organization_id=$2 AND s.is_active=true
        ORDER BY s.session_date DESC
      `, [userId, orgId]),
      query('SELECT * FROM v_attendance_summary WHERE user_id=$1', [userId]),
    ]);
    res.json({ history: history.rows, summary: summary.rows[0] || null });
  } catch (err) { next(err); }
};

// GET /api/attendance/calendar/:userId
const getCalendarData = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { month, year } = req.query;
    const orgId = req.user.organization_id;
    if (req.user.role === 'member' && req.user.id !== userId)
      return res.status(403).json({ error: 'Sin acceso' });
    const result = await query(`
      SELECT
        s.id AS session_id, s.title, s.session_date, s.group_name,
        COALESCE(a.status,'absent') AS status, a.id AS attendance_id,
        j.id AS justification_id, j.status AS justification_status, j.reason
      FROM sessions s
      LEFT JOIN attendance a ON a.session_id=s.id AND a.user_id=$1
      LEFT JOIN justifications j ON j.session_id=s.id AND j.user_id=$1 AND j.status!='rejected'
      WHERE s.organization_id=$2 AND s.is_active=true
        AND EXTRACT(YEAR FROM s.session_date)=$3
        AND EXTRACT(MONTH FROM s.session_date)=$4
      ORDER BY s.session_date
    `, [userId, orgId, parseInt(year) || new Date().getFullYear(), parseInt(month) || new Date().getMonth()+1]);
    res.json({ calendar: result.rows });
  } catch (err) { next(err); }
};

module.exports = { saveBulkAttendance, updateAttendance, getAttendanceSummary, getUserAttendance, getCalendarData };
