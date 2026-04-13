const express = require('express');
const router  = express.Router();
const passport = require('passport');
const rateLimit = require('express-rate-limit');

const { requireAuth, requireAdmin } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const authCtrl    = require('../controllers/authController');
const sessionCtrl = require('../controllers/sessionController');
const attCtrl     = require('../controllers/attendanceController');
const justCtrl    = require('../controllers/justificationController');
const userCtrl    = require('../controllers/userController');
const reportCtrl  = require('../controllers/reportController');

const loginLimiter = rateLimit({ windowMs:15*60*1000, max:10, message:{ error:'Demasiados intentos. Espera 15 minutos.' } });
const apiLimiter   = rateLimit({ windowMs:60*1000, max:200 });
router.use(apiLimiter);

// ── AUTH ──────────────────────────────────────────────────────────────────────
router.post('/auth/register',              authCtrl.register);
router.post('/auth/join',                  authCtrl.joinOrganization);
router.get ('/auth/validate-code/:code',   authCtrl.validateInviteCode);
router.post('/auth/login',                 loginLimiter, authCtrl.login);
router.get ('/auth/me',                    requireAuth, authCtrl.getMe);
router.post('/auth/forgot-password',              authCtrl.forgotPassword);
router.post('/auth/reset-password',               authCtrl.resetPassword);
router.get ('/auth/validate-reset-token/:token',  authCtrl.validateResetToken);
router.post('/auth/test-email',                    requireAdmin, authCtrl.testEmail);
router.post('/auth/setup-2fa',             requireAuth, authCtrl.setup2FA);
router.post('/auth/verify-2fa',            requireAuth, authCtrl.verify2FA);
router.post('/auth/setup-organization',    requireAuth, authCtrl.setupOrganization);
router.post('/auth/invite-code/regenerate',requireAdmin, authCtrl.regenerateInviteCode);
router.get ('/auth/google',
  passport.authenticate('google', { scope:['profile','email'], session:false }));
router.get ('/auth/google/callback',
  passport.authenticate('google', { session:false, failureRedirect:`${process.env.FRONTEND_URL}/login?error=oauth` }),
  authCtrl.googleCallback);

// ── USERS ──────────────────────────────────────────────────────────────────────
router.get   ('/users',               requireAuth,  userCtrl.getUsers);
router.post  ('/users',               requireAdmin, userCtrl.createUser);
router.put   ('/users/:id',           requireAdmin, userCtrl.updateUser);
router.patch ('/users/:id/toggle',    requireAdmin, userCtrl.toggleUser);

// ── SESSIONS ───────────────────────────────────────────────────────────────────
router.get   ('/sessions',            requireAuth,  sessionCtrl.getSessions);
router.get   ('/sessions/:id',        requireAuth,  sessionCtrl.getSession);
router.post  ('/sessions',            requireAdmin, sessionCtrl.createSession);
router.put   ('/sessions/:id',        requireAdmin, sessionCtrl.updateSession);
router.delete('/sessions/:id',        requireAdmin, sessionCtrl.deleteSession);
router.post  ('/sessions/:id/circular', requireAdmin, justCtrl.sendSessionCircular);

// ── ATTENDANCE ─────────────────────────────────────────────────────────────────
router.post  ('/attendance/bulk',            requireAdmin, attCtrl.saveBulkAttendance);
router.patch ('/attendance/:id',             requireAdmin, attCtrl.updateAttendance);
router.get   ('/attendance/summary',         requireAuth,  attCtrl.getAttendanceSummary);
router.get   ('/attendance/user/:userId',    requireAuth,  attCtrl.getUserAttendance);
router.get   ('/attendance/calendar/:userId',requireAuth,  attCtrl.getCalendarData);

// ── JUSTIFICATIONS ─────────────────────────────────────────────────────────────
router.get   ('/justifications',                  requireAuth,  justCtrl.getJustifications);
router.post  ('/justifications',                  requireAuth,  upload.single('file'), justCtrl.createJustification);
router.get   ('/justifications/my-absences',      requireAuth,  justCtrl.getJustifiableAbsences);
router.get   ('/justifications/:id/file',         requireAuth,  justCtrl.getJustificationFile);
router.patch ('/justifications/:id/review',       requireAdmin, justCtrl.reviewJustification);
router.get   ('/justifications/:id/messages',     requireAuth,  justCtrl.getJustificationMessages);
router.post  ('/justifications/:id/messages',     requireAuth,  justCtrl.addJustificationMessage);

// ── REPORTS ────────────────────────────────────────────────────────────────────
router.get('/reports/dashboard',        requireAuth, reportCtrl.getDashboardStats);
router.get('/reports/user/:userId',     requireAuth, reportCtrl.getUserReport);
router.get('/reports/session/:id',      requireAuth, reportCtrl.getSessionReport);
router.get('/reports/general',          requireAuth, reportCtrl.getGeneralReport);
router.get('/reports/export/pdf',       requireAuth, reportCtrl.exportPDF);
router.get('/reports/export/excel',     requireAuth, reportCtrl.exportExcel);

// ── NOTIFICATIONS ──────────────────────────────────────────────────────────────
router.get   ('/notifications',      requireAuth, reportCtrl.getNotifications);
router.patch ('/notifications/read', requireAuth, reportCtrl.markNotificationsRead);

// ── ORGANIZATION ───────────────────────────────────────────────────────────────
router.get('/organization', requireAuth, async (req,res,next) => {
  try {
    const { query } = require('../config/database');
    const r = await query('SELECT * FROM organizations WHERE id=$1', [req.user.organization_id]);
    res.json({ organization: r.rows[0] });
  } catch(err){ next(err); }
});
router.put('/organization', requireAdmin, async (req,res,next) => {
  try {
    const { query } = require('../config/database');
    const { name, email, threshold } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es requerido' });
    if (threshold < 1 || threshold > 100) return res.status(400).json({ error: 'Umbral debe estar entre 1 y 100' });
    const r = await query('UPDATE organizations SET name=$1,email=$2,threshold=$3 WHERE id=$4 RETURNING *',
      [name, email, threshold, req.user.organization_id]);
    res.json({ organization: r.rows[0] });
  } catch(err){ next(err); }
});

module.exports = router;
