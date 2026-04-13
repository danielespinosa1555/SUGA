const nodemailer = require('nodemailer');

// ── Transporter ──────────────────────────────────────────────────────────────
function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,           // true for 465, false for 587
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false,    // accept self-signed certs
      ciphers: 'SSLv3',
    },
    connectionTimeout: 10000,
    greetingTimeout:   10000,
    socketTimeout:     15000,
  });
}

const FROM_NAME  = process.env.EMAIL_FROM_NAME || 'SUGA';
const FROM_ADDR  = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@suga.app';
const FROM       = `"${FROM_NAME}" <${FROM_ADDR}>`;

// ── Send ─────────────────────────────────────────────────────────────────────
const send = async ({ to, subject, html }) => {
  const transporter = createTransporter();

  if (!transporter) {
    console.warn(`[MAILER] ⚠️  SMTP not configured — email NOT sent`);
    console.warn(`[MAILER]    To: ${to}`);
    console.warn(`[MAILER]    Subject: ${subject}`);
    return { skipped: true };
  }

  try {
    const info = await transporter.sendMail({ from: FROM, to, subject, html });
    console.log(`[MAILER] ✅ Sent → ${to} | msgId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[MAILER] ❌ Failed → ${to}: ${err.message}`);
    // Don't throw — email failure should not crash the request
    return { error: err.message };
  }
};

// ── Bulk send (for circular) ─────────────────────────────────────────────────
const sendBulk = async (recipients, subject, html) => {
  const results = [];
  for (const to of recipients) {
    const r = await send({ to, subject, html });
    results.push({ to, ...r });
    // Small delay to avoid rate limits
    await new Promise(res => setTimeout(res, 150));
  }
  const sent    = results.filter(r => r.success).length;
  const skipped = results.filter(r => r.skipped).length;
  const failed  = results.filter(r => r.error).length;
  console.log(`[MAILER] Bulk: ${sent} sent, ${skipped} skipped (no SMTP), ${failed} failed`);
  return results;
};

// ── Base HTML template ───────────────────────────────────────────────────────
const base = (content, orgName = 'SUGA') => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${orgName}</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;background:#f4f4f8;margin:0;padding:0;color:#1a1a2e;}
    .wrap{max-width:540px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e0dff0;box-shadow:0 4px 24px rgba(0,0,0,0.08);}
    .head{background:#6C5CE7;padding:28px 36px;text-align:center;}
    .head h1{margin:0;font-size:24px;color:#ffffff;letter-spacing:-0.3px;font-weight:700;}
    .head p{margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.8);}
    .body{padding:32px 36px;}
    .body p{margin:0 0 16px;font-size:14px;line-height:1.7;color:#444466;}
    .btn{display:inline-block;background:#6C5CE7;color:#ffffff!important;text-decoration:none;padding:13px 32px;border-radius:8px;font-size:14px;font-weight:600;margin:8px 0 16px;border:none;}
    .info{background:#f8f7ff;border:1px solid #e8e6ff;border-radius:8px;padding:16px 20px;margin:16px 0;font-size:13px;color:#5a5880;line-height:1.6;}
    .info strong{color:#3d3b60;}
    .msg-box{background:#f0f4ff;border-left:4px solid #6C5CE7;border-radius:0 8px 8px 0;padding:16px 20px;margin:16px 0;font-size:14px;color:#2d2b4e;line-height:1.7;}
    .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;}
    .green{background:#d4f7ec;color:#0a7a4e;}
    .red{background:#fde8ec;color:#b91c3a;}
    .amber{background:#fff4d4;color:#92640a;}
    .purple{background:#ede8ff;color:#5b21b6;}
    .foot{background:#f8f7ff;border-top:1px solid #e8e6ff;padding:18px 36px;font-size:11px;color:#9090b0;text-align:center;line-height:1.6;}
    .foot a{color:#6C5CE7;text-decoration:none;}
    @media(max-width:600px){.body{padding:24px 20px;}.head{padding:22px 20px;}.foot{padding:16px 20px;}}
  </style>
</head>
<body>
  <div class="wrap">
    ${content}
    <div class="foot">
      <strong>SUGA</strong> · Sistema Universal de Gestión de Asistencia<br>
      Este es un correo automático — por favor no respondas a este mensaje.
    </div>
  </div>
</body>
</html>`;

// ── Email Templates ──────────────────────────────────────────────────────────
const templates = {

  passwordReset: ({ name, resetUrl }) => ({
    subject: 'Recuperación de contraseña — SUGA',
    html: base(`
      <div class="head"><h1>🔐 SUGA</h1><p>Recuperación de contraseña</p></div>
      <div class="body">
        <p>Hola <strong>${name}</strong>,</p>
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta. Si no fuiste tú, ignora este correo sin problema.</p>
        <p style="text-align:center;margin:24px 0;">
          <a class="btn" href="${resetUrl}">Restablecer mi contraseña →</a>
        </p>
        <div class="info">
          ⏱ <strong>Este enlace expira en 1 hora.</strong><br><br>
          Si el botón no funciona, copia y pega esta URL en tu navegador:<br>
          <span style="word-break:break-all;color:#6C5CE7;font-size:12px;">${resetUrl}</span>
        </div>
        <p style="font-size:12px;color:#9090b0;">Si no solicitaste este cambio, tu contraseña permanecerá igual.</p>
      </div>`),
  }),

  justificationSubmitted: ({ adminName, memberName, sessionTitle, sessionDate, reason }) => ({
    subject: `Nueva justificación de ${memberName} — SUGA`,
    html: base(`
      <div class="head"><h1>📋 Nueva justificación</h1><p>Solicitud pendiente de revisión</p></div>
      <div class="body">
        <p>Hola <strong>${adminName}</strong>,</p>
        <p><strong>${memberName}</strong> envió una justificación de ausencia que requiere tu revisión.</p>
        <div class="info">
          <strong>Sesión:</strong> ${sessionTitle}<br>
          <strong>Fecha:</strong> ${sessionDate}<br>
          <strong>Motivo:</strong> ${reason}
        </div>
        <p>Ingresa a SUGA para revisar el documento adjunto y tomar una decisión.</p>
      </div>`),
  }),

  justificationApproved: ({ memberName, sessionTitle, sessionDate }) => ({
    subject: '✅ Tu justificación fue aprobada — SUGA',
    html: base(`
      <div class="head"><h1>✅ Justificación aprobada</h1><p>Tu solicitud fue aceptada</p></div>
      <div class="body">
        <p>Hola <strong>${memberName}</strong>,</p>
        <p>Tu justificación de ausencia fue <span class="badge green">Aprobada</span> y tu registro de asistencia ha sido actualizado.</p>
        <div class="info">
          <strong>Sesión:</strong> ${sessionTitle}<br>
          <strong>Fecha:</strong> ${sessionDate}
        </div>
        <p style="color:#0a7a4e;font-weight:600;">Esta ausencia ya no afectará tu porcentaje de asistencia. ✓</p>
      </div>`),
  }),

  justificationRejected: ({ memberName, sessionTitle, sessionDate, comment }) => ({
    subject: '❌ Tu justificación fue rechazada — SUGA',
    html: base(`
      <div class="head"><h1>Justificación rechazada</h1><p>Tu solicitud no fue aceptada</p></div>
      <div class="body">
        <p>Hola <strong>${memberName}</strong>,</p>
        <p>Tu justificación de ausencia fue <span class="badge red">Rechazada</span>.</p>
        <div class="info">
          <strong>Sesión:</strong> ${sessionTitle}<br>
          <strong>Fecha:</strong> ${sessionDate}<br>
          <strong>Motivo del rechazo:</strong> ${comment}
        </div>
        <p>Si consideras que fue un error, puedes enviar una nueva justificación con documentación adicional.</p>
      </div>`),
  }),

  attendanceAlert: ({ memberName, pct, threshold, orgName }) => ({
    subject: `⚠️ Alerta de asistencia — ${pct.toFixed(1)}% — SUGA`,
    html: base(`
      <div class="head"><h1>⚠️ Alerta de asistencia</h1><p>${orgName}</p></div>
      <div class="body">
        <p>Hola <strong>${memberName}</strong>,</p>
        <p>Tu porcentaje de asistencia está por debajo del mínimo requerido.</p>
        <div class="info" style="text-align:center;padding:24px;">
          <span style="font-size:42px;font-weight:800;color:#b91c3a;">${pct.toFixed(1)}%</span><br>
          <span style="font-size:12px;color:#9090b0;">Mínimo requerido: <strong>${threshold}%</strong></span>
        </div>
        <p>Ingresa a SUGA para revisar tu historial y enviar justificaciones pendientes.</p>
      </div>`, orgName),
  }),

  sessionCircular: ({ memberName, adminName, orgName, sessionTitle, sessionDate, message, frontendUrl }) => ({
    subject: `[${orgName}] ${sessionTitle} — Comunicado`,
    html: base(`
      <div class="head"><h1>${orgName}</h1><p>Comunicado · ${sessionTitle}</p></div>
      <div class="body">
        <p>Hola <strong>${memberName}</strong>,</p>
        <p>El administrador <strong>${adminName}</strong> te envía el siguiente comunicado:</p>
        <div class="msg-box">${message.replace(/\n/g, '<br>')}</div>
        <div class="info">
          <strong>Sesión:</strong> ${sessionTitle}<br>
          <strong>Fecha:</strong> ${sessionDate}
        </div>
        <p style="text-align:center;margin-top:24px;">
          <a class="btn" href="${frontendUrl}/my-attendance">Ver mi asistencia en SUGA →</a>
        </p>
      </div>`, orgName),
  }),

};

module.exports = { send, sendBulk, templates };
