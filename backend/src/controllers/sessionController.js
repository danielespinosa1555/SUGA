const { query } = require('../config/database');

// GET /api/sessions
const getSessions = async (req, res, next) => {
  try {
    const { group, startDate, endDate, page = 1, limit = 20 } = req.query;
    const pageNum  = Math.max(1, parseInt(page)  || 1);
    const limitNum = Math.min(100, parseInt(limit) || 20);
    const offset   = (pageNum - 1) * limitNum;
    const orgId    = req.user.organization_id;

    let conditions = ['s.organization_id=$1', 's.is_active=true'];
    let params = [orgId];
    let idx = 2;

    if (group)     { conditions.push(`s.group_name=$${idx++}`);    params.push(group); }
    if (startDate) { conditions.push(`s.session_date>=$${idx++}`); params.push(startDate); }
    if (endDate)   { conditions.push(`s.session_date<=$${idx++}`); params.push(endDate); }

    const where       = 'WHERE ' + conditions.join(' AND ');
    const filterParams = [...params];  // copy before adding pagination

    const [result, countResult] = await Promise.all([
      query(`
        SELECT
          s.id, s.title, s.description, s.session_date, s.start_time, s.end_time,
          s.group_name, s.location, s.created_at,
          u.first_name || ' ' || u.last_name AS created_by_name,
          COUNT(DISTINCT a.id)                                                            AS total_records,
          COUNT(CASE WHEN a.status = 'present'   THEN 1 END)                             AS present_count,
          COUNT(CASE WHEN a.status = 'absent'    THEN 1 END)                             AS absent_count,
          COUNT(CASE WHEN a.status = 'justified' THEN 1 END)                             AS justified_count,
          COUNT(CASE WHEN a.status = 'late'      THEN 1 END)                             AS late_count,
          CASE
            WHEN COUNT(DISTINCT a.id) = 0 THEN 0
            ELSE ROUND(
              COUNT(CASE WHEN a.status IN ('present','justified','late') THEN 1 END)::NUMERIC
              / NULLIF(COUNT(DISTINCT a.id)::NUMERIC, 0) * 100, 1)
          END AS attendance_pct
        FROM sessions s
        LEFT JOIN users      u ON u.id = s.created_by
        LEFT JOIN attendance a ON a.session_id = s.id
        ${where}
        GROUP BY s.id, u.first_name, u.last_name
        ORDER BY s.session_date DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      `, [...params, limitNum, offset]),
      query(`SELECT COUNT(*) FROM sessions s ${where}`, filterParams),
    ]);

    res.json({
      sessions: result.rows,
      total:    parseInt(countResult.rows[0].count),
      page:     pageNum,
      pages:    Math.ceil(countResult.rows[0].count / limitNum),
    });
  } catch (err) { next(err); }
};

// GET /api/sessions/:id
const getSession = async (req, res, next) => {
  try {
    const { id }  = req.params;
    const orgId   = req.user.organization_id;

    const [sessionResult, attendanceResult] = await Promise.all([
      query(`
        SELECT s.*, u.first_name || ' ' || u.last_name AS created_by_name
        FROM sessions s
        LEFT JOIN users u ON u.id = s.created_by
        WHERE s.id = $1 AND s.organization_id = $2
      `, [id, orgId]),

      query(`
        SELECT
          u.id, u.first_name, u.last_name, u.email, u.group_name, u.role, u.avatar_url,
          COALESCE(a.status, 'absent')      AS status,
          a.id                              AS attendance_id,
          a.notes,
          j.id                              AS justification_id,
          j.status                          AS justification_status
        FROM users u
        LEFT JOIN attendance    a ON a.session_id = $1 AND a.user_id = u.id
        LEFT JOIN justifications j ON j.attendance_id = a.id AND j.status != 'rejected'
        WHERE u.organization_id = $2 AND u.is_active = true
        ORDER BY u.role DESC, u.first_name, u.last_name
      `, [id, orgId]),
    ]);

    if (!sessionResult.rows[0]) return res.status(404).json({ error: 'Sesión no encontrada' });

    res.json({ session: sessionResult.rows[0], attendance: attendanceResult.rows });
  } catch (err) { next(err); }
};

// POST /api/sessions
const createSession = async (req, res, next) => {
  try {
    const { title, description, sessionDate, startTime, endTime, groupName, location } = req.body;

    if (!title || !title.trim())
      return res.status(400).json({ error: 'El título es requerido' });
    if (!sessionDate)
      return res.status(400).json({ error: 'La fecha es requerida' });

    const orgId = req.user.organization_id;

    const result = await query(`
      INSERT INTO sessions
        (organization_id, created_by, title, description, session_date, start_time, end_time, group_name, location)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      orgId,
      req.user.id,
      title.trim(),
      description  || null,
      sessionDate,
      startTime    || null,
      endTime      || null,
      groupName    || 'General',
      location     || null,
    ]);

    const session = result.rows[0];

    // Auto-create absent records for ALL active users in org
    const members = await query(
      `SELECT id FROM users WHERE organization_id = $1 AND is_active = true`, [orgId]
    );
    if (members.rows.length > 0) {
      const values = members.rows.map((_, i) => `($1, $${i + 2}, 'absent', $${members.rows.length + 2})`).join(', ');
      const args   = [session.id, ...members.rows.map(m => m.id), req.user.id];
      await query(`
        INSERT INTO attendance (session_id, user_id, status, recorded_by)
        VALUES ${values}
        ON CONFLICT (session_id, user_id) DO NOTHING
      `, args);
    }

    res.status(201).json({ session, message: 'Sesión creada exitosamente' });
  } catch (err) { next(err); }
};

// PUT /api/sessions/:id
const updateSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, sessionDate, startTime, endTime, groupName, location } = req.body;

    if (!title || !title.trim())
      return res.status(400).json({ error: 'El título es requerido' });
    if (!sessionDate)
      return res.status(400).json({ error: 'La fecha es requerida' });

    const result = await query(`
      UPDATE sessions
      SET title=$1, description=$2, session_date=$3, start_time=$4,
          end_time=$5, group_name=$6, location=$7
      WHERE id=$8 AND organization_id=$9
      RETURNING *
    `, [
      title.trim(), description || null, sessionDate,
      startTime || null, endTime || null,
      groupName || 'General', location || null,
      id, req.user.organization_id,
    ]);

    if (!result.rows[0]) return res.status(404).json({ error: 'Sesión no encontrada' });
    res.json({ session: result.rows[0] });
  } catch (err) { next(err); }
};

// DELETE /api/sessions/:id  (soft delete)
const deleteSession = async (req, res, next) => {
  try {
    await query(
      `UPDATE sessions SET is_active = false WHERE id = $1 AND organization_id = $2`,
      [req.params.id, req.user.organization_id]
    );
    res.json({ message: 'Sesión eliminada' });
  } catch (err) { next(err); }
};

module.exports = { getSessions, getSession, createSession, updateSession, deleteSession };
