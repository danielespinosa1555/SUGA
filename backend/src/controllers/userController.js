const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

// GET /api/users  — FIXED: v_attendance_summary (not v_user_attendance_summary)
const getUsers = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { group, role, active } = req.query;

    let conditions = ['u.organization_id = $1'];
    let params = [orgId];
    let idx = 2;

    if (group)  { conditions.push(`u.group_name = $${idx++}`); params.push(group); }
    if (role)   { conditions.push(`u.role = $${idx++}`);       params.push(role); }
    if (active !== undefined) {
      conditions.push(`u.is_active = $${idx++}`);
      params.push(active === 'true');
    }

    const result = await query(`
      SELECT
        u.id, u.first_name, u.last_name, u.email, u.role, u.group_name,
        u.is_active, u.avatar_url, u.last_login, u.created_at,
        vas.attendance_pct,
        vas.total_sessions, vas.total_present, vas.total_absent, vas.total_justified
      FROM users u
      LEFT JOIN v_attendance_summary vas
        ON vas.user_id = u.id AND vas.organization_id = u.organization_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY u.first_name, u.last_name
    `, params);

    const org = await query('SELECT threshold FROM organizations WHERE id=$1', [orgId]);
    const threshold = org.rows[0]?.threshold || 75;

    const users = result.rows.map(u => ({
      ...u,
      attendancePct: u.attendance_pct,
      isAtRisk: u.attendance_pct !== null && parseFloat(u.attendance_pct) < threshold,
    }));

    res.json({ users });
  } catch (err) { next(err); }
};

// POST /api/users
const createUser = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, role, groupName } = req.body;
    if (!firstName || !lastName || !email)
      return res.status(400).json({ error: 'Nombre, apellido y correo son requeridos' });

    const orgId = req.user.organization_id;
    const existing = await query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rows[0]) return res.status(409).json({ error: 'Email ya registrado' });

    const hash = password ? await bcrypt.hash(password, 12) : null;
    const result = await query(`
      INSERT INTO users (organization_id,first_name,last_name,email,password_hash,role,group_name)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id,first_name,last_name,email,role,group_name,is_active
    `, [orgId, firstName, lastName, email, hash, role || 'member', groupName || null]);

    res.status(201).json({ user: result.rows[0] });
  } catch (err) { next(err); }
};

// PUT /api/users/:id
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, role, groupName, isActive } = req.body;
    const orgId = req.user.organization_id;

    const result = await query(`
      UPDATE users SET first_name=$1,last_name=$2,email=$3,role=$4,group_name=$5,is_active=$6
      WHERE id=$7 AND organization_id=$8
      RETURNING id,first_name,last_name,email,role,group_name,is_active
    `, [firstName, lastName, email, role, groupName, isActive, id, orgId]);

    if (!result.rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ user: result.rows[0] });
  } catch (err) { next(err); }
};

// PATCH /api/users/:id/toggle
const toggleUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const orgId = req.user.organization_id;
    // Prevent self-deactivation
    if (id === req.user.id)
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
    const result = await query(`
      UPDATE users SET is_active=NOT is_active WHERE id=$1 AND organization_id=$2
      RETURNING is_active,first_name
    `, [id, orgId]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ isActive: result.rows[0].is_active });
  } catch (err) { next(err); }
};

module.exports = { getUsers, createUser, updateUser, toggleUser };
