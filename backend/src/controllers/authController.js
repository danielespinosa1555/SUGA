const bcrypt   = require('bcryptjs');
const speakeasy = require('speakeasy');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { generateToken } = require('../middleware/auth');
const mailer = require('../config/mailer');

/* ── Generate a random 8-char alphanumeric invite code ──────────────────── */
const makeInviteCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const getOrCreateInviteCode = async (orgId) => {
  const r = await query('SELECT invite_code FROM organizations WHERE id=$1', [orgId]);
  if (r.rows[0]?.invite_code) return r.rows[0].invite_code;
  let code, tries = 0;
  do {
    code = makeInviteCode();
    tries++;
    if (tries > 20) throw new Error('No se pudo generar código único');
  } while ((await query('SELECT id FROM organizations WHERE invite_code=$1', [code])).rows[0]);
  await query('UPDATE organizations SET invite_code=$1 WHERE id=$2', [code, orgId]);
  return code;
};

// ── POST /api/auth/register ───────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, organizationName } = req.body;
    if (!firstName || !lastName || !email || !password)
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    if (password.length < 8)
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

    const existing = await query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rows[0]) return res.status(409).json({ error: 'El correo ya está registrado' });

    const slug = (organizationName || `org-${uuidv4().slice(0,8)}`)
      .toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 50)
      + '-' + uuidv4().slice(0, 6);

    const inviteCode = makeInviteCode();
    const orgResult = await query(
      `INSERT INTO organizations (name, slug, email, invite_code) VALUES ($1,$2,$3,$4) RETURNING id, invite_code`,
      [organizationName || `Org de ${firstName}`, slug, email, inviteCode]
    );
    const orgId = orgResult.rows[0].id;

    const passwordHash = await bcrypt.hash(password, 12);
    const userResult = await query(`
      INSERT INTO users (organization_id, first_name, last_name, email, password_hash, role)
      VALUES ($1,$2,$3,$4,$5,'admin')
      RETURNING id, first_name, last_name, email, role, organization_id
    `, [orgId, firstName, lastName, email, passwordHash]);

    const user  = userResult.rows[0];
    const token = generateToken(user);
    res.status(201).json({
      message: 'Cuenta creada exitosamente',
      token,
      inviteCode: orgResult.rows[0].invite_code,
      user: { id:user.id, firstName:user.first_name, lastName:user.last_name, email:user.email, role:user.role },
    });
  } catch (err) { next(err); }
};

// ── POST /api/auth/join ───────────────────────────────────────────────────
const joinOrganization = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, inviteCode } = req.body;
    if (!firstName || !lastName || !email || !password || !inviteCode)
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    if (password.length < 8)
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

    const existing = await query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rows[0]) return res.status(409).json({ error: 'El correo ya está registrado' });

    const orgResult = await query(
      `SELECT id, name FROM organizations WHERE invite_code=$1`,
      [inviteCode.toUpperCase().trim()]
    );
    if (!orgResult.rows[0])
      return res.status(404).json({ error: 'Código de invitación inválido. Verifica con tu administrador.' });

    const org = orgResult.rows[0];
    const passwordHash = await bcrypt.hash(password, 12);
    const userResult = await query(`
      INSERT INTO users (organization_id, first_name, last_name, email, password_hash, role)
      VALUES ($1,$2,$3,$4,$5,'member')
      RETURNING id, first_name, last_name, email, role, organization_id
    `, [org.id, firstName, lastName, email, passwordHash]);

    const user  = userResult.rows[0];
    const token = generateToken(user);

    const admins = await query(
      `SELECT id, email, first_name FROM users WHERE organization_id=$1 AND role='admin' AND is_active=true`,
      [org.id]
    );
    for (const admin of admins.rows) {
      await query(
        `INSERT INTO notifications (user_id, type, title, message) VALUES ($1,'new_member','Nuevo miembro',$2)`,
        [admin.id, `${firstName} ${lastName} se unió a ${org.name} con el código de invitación`]
      );
    }

    res.status(201).json({
      message: `Te uniste a "${org.name}" exitosamente`,
      token,
      organizationName: org.name,
      user: { id:user.id, firstName:user.first_name, lastName:user.last_name, email:user.email, role:user.role },
    });
  } catch (err) { next(err); }
};

// ── GET /api/auth/validate-code/:code ────────────────────────────────────
const validateInviteCode = async (req, res, next) => {
  try {
    const { code } = req.params;
    const r = await query(
      `SELECT name, (SELECT COUNT(*) FROM users WHERE organization_id=organizations.id AND is_active=true) AS member_count
       FROM organizations WHERE invite_code=$1`,
      [code.toUpperCase().trim()]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Código inválido' });
    res.json({ valid: true, organizationName: r.rows[0].name, memberCount: parseInt(r.rows[0].member_count) });
  } catch (err) { next(err); }
};

// ── POST /api/auth/login ──────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password, totpCode } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña son requeridos' });

    const result = await query('SELECT * FROM users WHERE email=$1 AND is_active=true', [email]);
    const user = result.rows[0];
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Credenciales inválidas' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

    if (user.two_factor_enabled && user.two_factor_secret) {
      if (!totpCode) return res.status(200).json({ requires2FA: true });
      const ok = speakeasy.totp.verify({ secret:user.two_factor_secret, encoding:'base32', token:totpCode, window:1 });
      if (!ok) return res.status(401).json({ error: 'Código 2FA inválido' });
    }

    await query('UPDATE users SET last_login=NOW() WHERE id=$1', [user.id]);
    const token = generateToken(user);
    res.json({
      token,
      user: { id:user.id, firstName:user.first_name, lastName:user.last_name, email:user.email, role:user.role, organizationId:user.organization_id, avatarUrl:user.avatar_url },
    });
  } catch (err) { next(err); }
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    const r = await query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.group_name,
             u.avatar_url, u.organization_id, u.two_factor_enabled, u.last_login,
             o.name AS org_name, o.threshold, o.invite_code
      FROM users u LEFT JOIN organizations o ON o.id=u.organization_id
      WHERE u.id=$1
    `, [req.user.id]);
    const u = r.rows[0];
    res.json({
      id:u.id, firstName:u.first_name, lastName:u.last_name, email:u.email, role:u.role,
      groupName:u.group_name, avatarUrl:u.avatar_url, organizationId:u.organization_id,
      organizationName:u.org_name, threshold:u.threshold, twoFactorEnabled:u.two_factor_enabled,
      lastLogin:u.last_login, inviteCode:u.invite_code,
    });
  } catch (err) { next(err); }
};

// ── POST /api/auth/invite-code/regenerate ────────────────────────────────
const regenerateInviteCode = async (req, res, next) => {
  try {
    let code, tries = 0;
    do {
      code = makeInviteCode();
      tries++;
    } while (tries < 20 && (await query('SELECT id FROM organizations WHERE invite_code=$1',[code])).rows[0]);
    await query('UPDATE organizations SET invite_code=$1 WHERE id=$2', [code, req.user.organization_id]);
    res.json({ inviteCode: code, message: 'Código regenerado. El código anterior ya no funciona.' });
  } catch (err) { next(err); }
};

// ── POST /api/auth/forgot-password ───────────────────────────────────────
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'El correo es requerido' });
    const userR = await query('SELECT id, first_name, last_name FROM users WHERE email=$1 AND is_active=true', [email]);
    if (!userR.rows[0]) return res.json({ message: 'Si el correo existe recibirás instrucciones' });
    const user = userR.rows[0];
    const token = uuidv4();
    await query(`UPDATE password_reset_tokens SET used=true WHERE user_id=$1 AND used=false`, [user.id]);
    await query(`INSERT INTO password_reset_tokens (user_id,token,expires_at) VALUES ($1,$2,$3)`,
      [user.id, token, new Date(Date.now() + 3600000)]);
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    const { subject, html } = mailer.templates.passwordReset({ name:`${user.first_name} ${user.last_name}`, resetUrl });
    await mailer.send({ to: email, subject, html });
    res.json({ message: 'Si el correo existe recibirás instrucciones' });
  } catch (err) { next(err); }
};

// ── POST /api/auth/reset-password ────────────────────────────────────────
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password || password.length < 8)
      return res.status(400).json({ error: 'Token y contraseña (mín. 8 chars) requeridos' });
    const r = await query(
      `SELECT * FROM password_reset_tokens WHERE token=$1 AND used=false AND expires_at>NOW()`, [token]);
    if (!r.rows[0]) return res.status(400).json({ error: 'Enlace inválido o expirado' });
    await query('UPDATE users SET password_hash=$1 WHERE id=$2', [await bcrypt.hash(password, 12), r.rows[0].user_id]);
    await query('UPDATE password_reset_tokens SET used=true WHERE token=$1', [token]);
    res.json({ message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
  } catch (err) { next(err); }
};

// ── 2FA ───────────────────────────────────────────────────────────────────
const setup2FA = async (req, res, next) => {
  try {
    const secret = speakeasy.generateSecret({ name:`SUGA (${req.user.email})`, length:20 });
    await query('UPDATE users SET two_factor_secret=$1 WHERE id=$2', [secret.base32, req.user.id]);
    res.json({ secret:secret.base32, otpauthUrl:secret.otpauth_url });
  } catch (err) { next(err); }
};

const verify2FA = async (req, res, next) => {
  try {
    const { code } = req.body;
    const r = await query('SELECT two_factor_secret FROM users WHERE id=$1', [req.user.id]);
    const ok = speakeasy.totp.verify({ secret:r.rows[0].two_factor_secret, encoding:'base32', token:code, window:1 });
    if (!ok) return res.status(400).json({ error: 'Código inválido' });
    await query('UPDATE users SET two_factor_enabled=true WHERE id=$1', [req.user.id]);
    res.json({ message: '2FA activado' });
  } catch (err) { next(err); }
};

// ── Google OAuth ──────────────────────────────────────────────────────────
const googleCallback = async (req, res) => {
  try {
    const user = req.user;
    const token = generateToken(user);
    if (!user.organization_id)
      return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}&needsOrg=true`);
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  } catch { res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth`); }
};

const setupOrganization = async (req, res, next) => {
  try {
    const { organizationName } = req.body;
    if (!organizationName?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
    const check = await query('SELECT organization_id FROM users WHERE id=$1', [req.user.id]);
    if (check.rows[0]?.organization_id) return res.status(409).json({ error: 'Ya perteneces a una organización' });
    const inviteCode = makeInviteCode();
    const slug = organizationName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0,50) + '-' + uuidv4().slice(0,6);
    const orgR = await query(`INSERT INTO organizations (name,slug,email,invite_code) VALUES ($1,$2,$3,$4) RETURNING id`,
      [organizationName.trim(), slug, req.user.email, inviteCode]);
    await query(`UPDATE users SET organization_id=$1, role='admin' WHERE id=$2`, [orgR.rows[0].id, req.user.id]);
    const updUser = await query(`SELECT id,email,role,organization_id FROM users WHERE id=$1`, [req.user.id]);
    res.json({ message: 'Organización creada', token: generateToken(updUser.rows[0]), inviteCode });
  } catch (err) { next(err); }
};

// ── GET /api/auth/validate-reset-token/:token ────────────────────────────
const validateResetToken = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ valid: false, error: 'Token requerido' });
    const r = await query(
      `SELECT prt.id, u.first_name, u.last_name, u.email,
              prt.expires_at,
              (prt.expires_at > NOW()) AS is_valid
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token=$1 AND prt.used=false`,
      [token]
    );
    if (!r.rows[0]) return res.status(400).json({ valid: false, error: 'Enlace inválido o ya fue usado' });
    if (!r.rows[0].is_valid) return res.status(400).json({ valid: false, error: 'Este enlace expiró. Solicita uno nuevo.' });
    res.json({ valid: true, name: `${r.rows[0].first_name} ${r.rows[0].last_name}`, email: r.rows[0].email });
  } catch (err) { next(err); }
};

// ── POST /api/auth/test-email  (admin only — dev/debug) ──────────────────
const testEmail = async (req, res, next) => {
  try {
    const { to } = req.body;
    const target = to || req.user.email;
    const result = await mailer.send({
      to: target,
      subject: '✅ SUGA — Prueba de correo',
      html: `<div style="font-family:Arial;padding:32px;background:#f4f4f8;">
        <div style="max-width:500px;margin:0 auto;background:white;padding:32px;border-radius:12px;border:1px solid #e0dff0;">
          <h2 style="color:#6C5CE7;margin-top:0">✅ ¡El correo funciona!</h2>
          <p style="color:#444466;">Este es un correo de prueba enviado desde SUGA.</p>
          <div style="background:#f8f7ff;border-radius:8px;padding:16px;margin:16px 0;font-size:13px;color:#5a5880;">
            <strong>SMTP Host:</strong> ${process.env.SMTP_HOST || 'smtp.gmail.com'}<br>
            <strong>SMTP User:</strong> ${process.env.SMTP_USER || '(no configurado)'}<br>
            <strong>Enviado a:</strong> ${target}<br>
            <strong>Hora:</strong> ${new Date().toLocaleString('es-CO')}
          </div>
          <p style="color:#9090b0;font-size:12px;">Si recibes este correo, la configuración SMTP está correcta.</p>
        </div>
      </div>`,
    });
    res.json({
      message: result.skipped ? 'SMTP no configurado — revisa SMTP_USER y SMTP_PASS en tu .env' : `Correo enviado a ${target}`,
      result,
      smtpUser: process.env.SMTP_USER || null,
      smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    });
  } catch (err) { next(err); }
};

// ── EXPORTS ───────────────────────────────────────────────────────────────
module.exports = {
  register, joinOrganization, validateInviteCode,
  login, getMe, forgotPassword, resetPassword, validateResetToken, testEmail,
  setup2FA, verify2FA, googleCallback, setupOrganization,
  regenerateInviteCode,
};