const { query } = require('../config/database');
const mailer = require('../config/mailer');

// GET /api/justifications
const getJustifications = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { status, mine, userId } = req.query;
    let conditions = ['s.organization_id = $1'];
    let params = [orgId];
    let idx = 2;
    if (req.user.role !== 'admin') { conditions.push(`j.user_id = $${idx++}`); params.push(req.user.id); }
    else if (mine === 'true') { conditions.push(`j.user_id = $${idx++}`); params.push(req.user.id); }
    else if (userId) { conditions.push(`j.user_id = $${idx++}`); params.push(userId); }
    if (status) { conditions.push(`j.status = $${idx++}`); params.push(status); }

    const result = await query(`
      SELECT j.id, j.reason, j.file_url, j.file_name, j.file_size, j.file_type,
        j.status, j.review_comment, j.reviewed_at, j.submitted_at,
        u.id AS user_id,
        u.first_name || ' ' || u.last_name AS user_name,
        u.email AS user_email, u.group_name, u.role AS user_role,
        s.id AS session_id, s.title AS session_title, s.session_date, s.group_name AS session_group,
        a.id AS attendance_id, a.status AS attendance_status,
        r.first_name || ' ' || r.last_name AS reviewer_name,
        (SELECT COUNT(*) FROM justification_messages jm WHERE jm.justification_id = j.id) AS message_count
      FROM justifications j
      JOIN users u    ON u.id = j.user_id
      JOIN sessions s ON s.id = j.session_id
      JOIN attendance a ON a.id = j.attendance_id
      LEFT JOIN users r ON r.id = j.reviewed_by
      WHERE ${conditions.join(' AND ')}
      ORDER BY j.submitted_at DESC
    `, params);
    res.json({ justifications: result.rows });
  } catch (err) { next(err); }
};

// GET /api/justifications/:id/file
const getJustificationFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const orgId = req.user.organization_id;
    const result = await query(`
      SELECT j.file_url, j.file_name, j.file_type, j.user_id
      FROM justifications j JOIN sessions s ON s.id = j.session_id
      WHERE j.id = $1 AND s.organization_id = $2
    `, [id, orgId]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Justificación no encontrada' });
    const j = result.rows[0];
    if (req.user.role !== 'admin' && j.user_id !== req.user.id) return res.status(403).json({ error: 'Sin acceso' });
    if (!j.file_url) return res.status(404).json({ error: 'Sin archivo adjunto' });
    const path = require('path');
    const fs = require('fs');
    const filePath = path.join(__dirname, '../../', j.file_url);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
    res.setHeader('Content-Type', j.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(j.file_name || 'archivo')}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) { next(err); }
};

// POST /api/justifications
const createJustification = async (req, res, next) => {
  try {
    const { attendanceId, sessionId, reason } = req.body;
    const userId = req.user.id;
    if (!reason || reason.trim().length < 5) return res.status(400).json({ error: 'El motivo debe tener al menos 5 caracteres' });
    if (!attendanceId || !sessionId) return res.status(400).json({ error: 'attendanceId y sessionId son requeridos' });
    const att = await query('SELECT * FROM attendance WHERE id=$1 AND user_id=$2', [attendanceId, userId]);
    if (!att.rows[0]) return res.status(404).json({ error: 'Registro de asistencia no encontrado' });
    if (att.rows[0].status === 'present') return res.status(400).json({ error: 'No puedes justificar una asistencia presente' });
    const existing = await query(`SELECT id,status FROM justifications WHERE attendance_id=$1 AND status NOT IN ('rejected')`, [attendanceId]);
    if (existing.rows[0]) return res.status(409).json({ error: `Ya existe una justificación ${existing.rows[0].status === 'approved' ? 'aprobada' : 'en proceso'}` });
    const fileData = req.file ? { url:`/uploads/justifications/${req.file.filename}`, name:req.file.originalname, size:req.file.size, type:req.file.mimetype } : {};
    const result = await query(`
      INSERT INTO justifications (attendance_id,user_id,session_id,reason,file_url,file_name,file_size,file_type)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [attendanceId, userId, sessionId, reason.trim(), fileData.url||null, fileData.name||null, fileData.size||null, fileData.type||null]);
    const sessionInfo = await query(`SELECT title, session_date FROM sessions WHERE id=$1`, [sessionId]);
    const s = sessionInfo.rows[0];
    const admins = await query(`SELECT id,email,first_name,last_name FROM users WHERE organization_id=$1 AND role='admin' AND is_active=true AND id!=$2`, [req.user.organization_id, userId]);
    for (const admin of admins.rows) {
      await query(`INSERT INTO notifications (user_id,type,title,message) VALUES ($1,'new_justification','Nueva justificación',$2)`,
        [admin.id, `${req.user.first_name} ${req.user.last_name} envió una justificación para revisión`]);
      const { subject, html } = mailer.templates.justificationSubmitted({
        adminName:`${admin.first_name} ${admin.last_name}`, memberName:`${req.user.first_name} ${req.user.last_name}`,
        sessionTitle:s?.title||'Sesión',
        sessionDate:s?.session_date ? new Date(s.session_date+'T12:00').toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) : '',
        reason:reason.trim(),
      });
      await mailer.send({ to:admin.email, subject, html });
    }
    res.status(201).json({ justification: result.rows[0], message: 'Justificación enviada correctamente' });
  } catch (err) { next(err); }
};

// PATCH /api/justifications/:id/review
const reviewJustification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, comment } = req.body;
    if (!['approved','rejected','review'].includes(status)) return res.status(400).json({ error: 'Estado inválido' });
    if (status === 'rejected' && (!comment || comment.trim().length < 5)) return res.status(400).json({ error: 'Debes indicar el motivo del rechazo' });
    const check = await query(`
      SELECT j.id, j.attendance_id, j.user_id, j.session_id, j.status
      FROM justifications j JOIN sessions s ON s.id = j.session_id
      WHERE j.id=$1 AND s.organization_id=$2
    `, [id, req.user.organization_id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Justificación no encontrada' });
    if (check.rows[0].status === 'approved') return res.status(400).json({ error: 'Esta justificación ya fue aprobada' });
    const result = await query(`UPDATE justifications SET status=$1,reviewed_by=$2,review_comment=$3,reviewed_at=NOW() WHERE id=$4 RETURNING *`,
      [status, req.user.id, comment?.trim()||null, id]);
    if (status === 'approved') await query(`UPDATE attendance SET status='justified' WHERE id=$1`, [check.rows[0].attendance_id]);
    if (status === 'rejected') await query(`UPDATE attendance SET status='absent' WHERE id=$1`, [check.rows[0].attendance_id]);
    const memberInfo = await query(`SELECT u.email,u.first_name,u.last_name FROM users u WHERE u.id=$1`, [check.rows[0].user_id]);
    const sessionInfo = await query(`SELECT title,session_date FROM sessions WHERE id=$1`, [check.rows[0].session_id]);
    const member = memberInfo.rows[0]; const s = sessionInfo.rows[0];
    const dateStr = s?.session_date ? new Date(s.session_date+'T12:00').toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) : '';
    const notifMap = {
      approved:{ title:'Justificación aprobada ✓', msg:'Tu justificación fue aprobada y no afectará tu porcentaje.' },
      rejected:{ title:'Justificación rechazada', msg:`Tu justificación fue rechazada. Motivo: ${comment}` },
      review:  { title:'Justificación en revisión', msg:'Tu justificación está siendo revisada por el administrador.' },
    };
    if (notifMap[status]) await query(`INSERT INTO notifications (user_id,type,title,message) VALUES ($1,$2,$3,$4)`,
      [check.rows[0].user_id, `justification_${status}`, notifMap[status].title, notifMap[status].msg]);
    if (member) {
      if (status === 'approved') { const {subject,html} = mailer.templates.justificationApproved({ memberName:`${member.first_name} ${member.last_name}`, sessionTitle:s?.title||'Sesión', sessionDate:dateStr }); await mailer.send({to:member.email,subject,html}); }
      else if (status === 'rejected') { const {subject,html} = mailer.templates.justificationRejected({ memberName:`${member.first_name} ${member.last_name}`, sessionTitle:s?.title||'Sesión', sessionDate:dateStr, comment:comment.trim() }); await mailer.send({to:member.email,subject,html}); }
    }
    res.json({ justification: result.rows[0] });
  } catch (err) { next(err); }
};

// GET /api/justifications/my-absences
const getJustifiableAbsences = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT a.id AS attendance_id, a.status, a.notes,
        s.id AS session_id, s.title, s.session_date, s.group_name, s.description,
        j.id AS justification_id, j.status AS justification_status, j.reason, j.submitted_at, j.review_comment
      FROM attendance a
      JOIN sessions s ON s.id=a.session_id
      LEFT JOIN justifications j ON j.attendance_id=a.id AND j.status!='rejected'
      WHERE a.user_id=$1 AND s.organization_id=$2 AND s.is_active=true AND a.status IN ('absent','late')
      ORDER BY s.session_date DESC
    `, [req.user.id, req.user.organization_id]);
    res.json({ absences: result.rows });
  } catch (err) { next(err); }
};

// ── CHAT MESSAGES ────────────────────────────────────────────────────────────

// GET /api/justifications/:id/messages
const getJustificationMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Verify access
    const justR = await query(`
      SELECT j.user_id, s.organization_id FROM justifications j JOIN sessions s ON s.id=j.session_id WHERE j.id=$1
    `, [id]);
    if (!justR.rows[0]) return res.status(404).json({ error: 'No encontrado' });
    const j = justR.rows[0];
    if (j.organization_id !== req.user.organization_id) return res.status(403).json({ error: 'Sin acceso' });
    if (req.user.role !== 'admin' && j.user_id !== req.user.id) return res.status(403).json({ error: 'Sin acceso' });

    const msgs = await query(`
      SELECT jm.id, jm.message, jm.created_at,
        u.id AS sender_id, u.first_name || ' ' || u.last_name AS sender_name, u.role AS sender_role
      FROM justification_messages jm JOIN users u ON u.id = jm.sender_id
      WHERE jm.justification_id = $1
      ORDER BY jm.created_at ASC
    `, [id]);
    res.json({ messages: msgs.rows });
  } catch (err) { next(err); }
};

// POST /api/justifications/:id/messages
const addJustificationMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    if (!message || message.trim().length < 1) return res.status(400).json({ error: 'Mensaje vacío' });

    // Verify access
    const justR = await query(`
      SELECT j.user_id, j.status, s.organization_id, s.title AS session_title,
        u.first_name || ' ' || u.last_name AS member_name, u.email AS member_email
      FROM justifications j JOIN sessions s ON s.id=j.session_id JOIN users u ON u.id=j.user_id
      WHERE j.id=$1
    `, [id]);
    if (!justR.rows[0]) return res.status(404).json({ error: 'No encontrado' });
    const j = justR.rows[0];
    if (j.organization_id !== req.user.organization_id) return res.status(403).json({ error: 'Sin acceso' });
    if (req.user.role !== 'admin' && j.user_id !== req.user.id) return res.status(403).json({ error: 'Sin acceso' });

    const result = await query(`
      INSERT INTO justification_messages (justification_id, sender_id, message) VALUES ($1,$2,$3)
      RETURNING id, message, created_at, sender_id
    `, [id, req.user.id, message.trim()]);

    // Notify the other party
    const isAdmin = req.user.role === 'admin';
    if (isAdmin) {
      // Notify the member
      await query(`INSERT INTO notifications (user_id,type,title,message) VALUES ($1,'justification_message','Nuevo mensaje en tu justificación',$2)`,
        [j.user_id, `${req.user.first_name} ${req.user.last_name} te envió un mensaje sobre tu justificación`]);
    } else {
      // Notify admins
      const admins = await query(`SELECT id FROM users WHERE organization_id=$1 AND role='admin' AND is_active=true`, [req.user.organization_id]);
      for (const admin of admins.rows) {
        await query(`INSERT INTO notifications (user_id,type,title,message) VALUES ($1,'justification_message','Respuesta de miembro',$2)`,
          [admin.id, `${req.user.first_name} ${req.user.last_name} respondió en una justificación`]);
      }
    }

    res.status(201).json({
      message: { ...result.rows[0], sender_name:`${req.user.first_name} ${req.user.last_name}`, sender_role:req.user.role }
    });
  } catch (err) { next(err); }
};

// POST /api/sessions/:id/circular — Admin sends email to all session members
const sendSessionCircular = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    if (!message || message.trim().length < 5) return res.status(400).json({ error: 'El mensaje debe tener al menos 5 caracteres' });

    // Get session + org
    const sessR = await query(`
      SELECT s.*, o.name AS org_name FROM sessions s JOIN organizations o ON o.id=s.organization_id
      WHERE s.id=$1 AND s.organization_id=$2
    `, [id, req.user.organization_id]);
    if (!sessR.rows[0]) return res.status(404).json({ error: 'Sesión no encontrada' });
    const session = sessR.rows[0];

    // Get all members with attendance in this session
    const membersR = await query(`
      SELECT DISTINCT u.id, u.email, u.first_name, u.last_name
      FROM attendance a JOIN users u ON u.id=a.user_id
      WHERE a.session_id=$1 AND u.is_active=true
    `, [id]);

    if (membersR.rows.length === 0) return res.status(400).json({ error: 'No hay miembros inscritos en esta sesión' });

    const adminName = `${req.user.first_name} ${req.user.last_name}`;
    const dateStr = session.session_date
      ? new Date(session.session_date+'T12:00').toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
      : '';

    let sent = 0;
    for (const member of membersR.rows) {
      const { subject, html } = mailer.templates.sessionCircular({
        memberName:  `${member.first_name} ${member.last_name}`,
        adminName,
        orgName:     session.org_name,
        sessionTitle: session.title,
        sessionDate:  dateStr,
        message:      message.trim(),
        frontendUrl:  process.env.FRONTEND_URL || 'https://app.suga.com',
      });
      const emailResult = await mailer.send({ to: member.email, subject, html });
      console.log(`[Circular] → ${member.email}: ${emailResult?.success ? '✅' : emailResult?.skipped ? '⚠️ skipped' : '❌ ' + emailResult?.error}`);
      await query(`INSERT INTO notifications (user_id,type,title,message) VALUES ($1,'session_circular',$2,$3)`,
        [member.id, `Circular: ${session.title}`, message.trim().slice(0,200)]);
      if (emailResult?.success || emailResult?.skipped) sent++;
    }

    const smtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
    res.json({ 
      sent, 
      message: smtpConfigured 
        ? `Circular enviada a ${sent} miembro(s)` 
        : `Notificaciones creadas para ${sent} miembro(s). SMTP no configurado — los correos no se enviaron. Configura SMTP_USER y SMTP_PASS en .env`,
      smtpConfigured,
    });
  } catch (err) { next(err); }
};

module.exports = {
  getJustifications, getJustificationFile, createJustification,
  reviewJustification, getJustifiableAbsences,
  getJustificationMessages, addJustificationMessage,
  sendSessionCircular,
};
