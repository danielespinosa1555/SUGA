const { query }    = require('../config/database');
const PDFDocument  = require('pdfkit');
const ExcelJS      = require('exceljs');

// ── helpers ───────────────────────────────────────────────────────────────────
const getOrg = async (orgId) => {
  const r = await query('SELECT threshold, name, email FROM organizations WHERE id=$1', [orgId]);
  return r.rows[0] || { threshold:75, name:'Organización', email:'' };
};

const fmtDate = (d, opts = {}) =>
  new Date(typeof d === 'string' && !d.includes('T') ? d + 'T12:00' : d)
    .toLocaleDateString('es-CO', { day:'numeric', month:'long', year:'numeric', ...opts });

const pctColor = (pct, threshold) =>
  pct >= threshold + 10 ? '#00C87A' : pct >= threshold ? '#F5A623' : '#FF4040';

// ── PDF HELPERS ───────────────────────────────────────────────────────────────
const PDF_BG     = '#0A0A08';
const PDF_CARD   = '#111110';
const PDF_CARD2  = '#1C1C1A';
const PDF_TEXT   = '#F2F0E8';
const PDF_DIM    = '#5C5A52';
const PDF_ACCENT = '#C8FF00';
const PDF_BORDER = '#272724';

const pdfHeader = (doc, org, title, subtitle) => {
  // dark background
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(PDF_BG);

  // left accent stripe
  doc.rect(0, 0, 4, doc.page.height).fill(PDF_ACCENT);

  // logo area
  doc.rect(30, 28, 36, 36).fillColor(PDF_ACCENT).fill();
  doc.fontSize(26).font('Helvetica-Bold').fillColor(PDF_BG).text('S', 30, 32, { width:36, align:'center' });

  // org name + version
  doc.fontSize(16).font('Helvetica-Bold').fillColor(PDF_TEXT).text('SUGA', 76, 30);
  doc.fontSize(8).font('Helvetica').fillColor(PDF_DIM).text(org.name, 76, 50);

  // top-right date
  doc.fontSize(8).font('Helvetica').fillColor(PDF_DIM)
     .text(new Date().toLocaleDateString('es-CO',{weekday:'short',day:'numeric',month:'long',year:'numeric'}).toUpperCase(),
       0, 35, { align:'right', width: doc.page.width - 40 });

  // title block
  doc.moveDown(0.5);
  doc.rect(30, 80, doc.page.width - 60, 1).fillColor(PDF_BORDER).fill();
  doc.fontSize(28).font('Helvetica-Bold').fillColor(PDF_ACCENT).text(title, 30, 94);
  if (subtitle) doc.fontSize(10).font('Helvetica').fillColor(PDF_DIM).text(subtitle, 30, 126);

  doc.rect(30, subtitle ? 142 : 126, doc.page.width - 60, 1).fillColor(PDF_BORDER).fill();
  doc.y = subtitle ? 158 : 140;
};

const pdfStat = (doc, x, y, label, value, color) => {
  const w = 110, h = 54;
  doc.rect(x, y, w, h).fillColor(PDF_CARD).fill();
  doc.rect(x, y, w, 2).fillColor(color).fill();
  doc.fontSize(7).font('Helvetica').fillColor(PDF_DIM).text(label.toUpperCase(), x+8, y+10, {width:w-16});
  doc.fontSize(22).font('Helvetica-Bold').fillColor(color).text(String(value), x+8, y+22, {width:w-16});
};

const pdfBar = (doc, x, y, width, pct, threshold) => {
  const filled = Math.min(100, pct) / 100 * width;
  const color  = pctColor(pct, threshold);
  doc.rect(x, y, width, 4).fillColor(PDF_CARD2).fill();
  doc.rect(x, y, filled, 4).fillColor(color).fill();
};

const pdfTableHeader = (doc, cols, y) => {
  const rowH = 20;
  doc.rect(30, y, doc.page.width - 60, rowH).fillColor(PDF_CARD2).fill();
  doc.fontSize(7).font('Helvetica-Bold').fillColor(PDF_DIM);
  cols.forEach(c => doc.text(c.label.toUpperCase(), c.x, y + 6, { width: c.w, align: c.align || 'left' }));
  return y + rowH;
};

const pdfTableRow = (doc, cols, data, y, isEven, threshold) => {
  const rowH = 22;
  if (y > doc.page.height - 60) { doc.addPage(); doc.rect(0,0,doc.page.width,doc.page.height).fill(PDF_BG); y = 40; }
  if (isEven) doc.rect(30, y, doc.page.width - 60, rowH).fillColor('#0F0F0D').fill();
  cols.forEach(c => {
    const val = data[c.key];
    let color = PDF_TEXT;
    if (c.type === 'pct') color = pctColor(parseFloat(val||0), threshold);
    if (c.type === 'present') color = '#00C87A';
    if (c.type === 'absent')  color = '#FF4040';
    if (c.type === 'late')    color = '#F5A623';
    if (c.type === 'just')    color = '#4DA6FF';
    if (c.type === 'dim')     color = PDF_DIM;
    doc.fontSize(c.size || 8).font(c.bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(color)
       .text(String(val ?? '—'), c.x, y + 7, { width: c.w, align: c.align || 'left', lineBreak: false });
  });
  if (data._pct !== undefined) {
    pdfBar(doc, 340, y + 9, 100, parseFloat(data._pct||0), threshold);
  }
  return y + rowH;
};

const pdfFooter = (doc) => {
  const y = doc.page.height - 30;
  doc.rect(0, y - 8, doc.page.width, 38).fillColor(PDF_BG).fill();
  doc.rect(30, y - 8, doc.page.width - 60, 1).fillColor(PDF_BORDER).fill();
  doc.fontSize(7).font('Helvetica').fillColor(PDF_DIM)
     .text(`SUGA · Generado ${new Date().toLocaleString('es-CO')} · Confidencial`, 30, y, { align:'center', width: doc.page.width - 60 });
};

// ── GET /api/reports/dashboard ────────────────────────────────────────────────
const getDashboardStats = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const org   = await getOrg(orgId);
    const { threshold } = org;

    const [summary, sessions, justif, risk, recentSessions, dayAbs, trend] = await Promise.all([
      query(`SELECT COUNT(*) AS total_users, ROUND(AVG(attendance_pct),1) AS avg_attendance, COUNT(*) FILTER (WHERE attendance_pct < $2) AS at_risk_count FROM v_attendance_summary WHERE organization_id=$1`, [orgId, threshold]),
      query(`SELECT COUNT(*) AS total_sessions FROM sessions WHERE organization_id=$1 AND is_active=true AND session_date >= DATE_TRUNC('month', NOW())`, [orgId]),
      query(`SELECT COUNT(*) FILTER (WHERE j.status IN ('pending','review')) AS pending, COUNT(*) FILTER (WHERE j.status='approved') AS approved, COUNT(*) AS total FROM justifications j JOIN sessions s ON s.id=j.session_id WHERE s.organization_id=$1`, [orgId]),
      query(`SELECT user_id, first_name, last_name, group_name, role, attendance_pct, total_absent, total_sessions FROM v_attendance_summary WHERE organization_id=$1 AND attendance_pct < $2 ORDER BY attendance_pct ASC LIMIT 8`, [orgId, threshold]),
      query(`SELECT s.id, s.title, s.session_date, s.group_name, COUNT(a.id) FILTER (WHERE a.status IN ('present','justified','late')) AS present, COUNT(a.id) AS total, CASE WHEN COUNT(a.id)=0 THEN 0 ELSE ROUND(COUNT(a.id) FILTER (WHERE a.status IN ('present','justified','late'))::NUMERIC / COUNT(a.id)::NUMERIC * 100,1) END AS pct FROM sessions s LEFT JOIN attendance a ON a.session_id=s.id WHERE s.organization_id=$1 AND s.is_active=true GROUP BY s.id ORDER BY s.session_date DESC LIMIT 6`, [orgId]),
      query(`SELECT TRIM(TO_CHAR(s.session_date,'Day')) AS day, EXTRACT(DOW FROM s.session_date) AS dow, COUNT(a.id) FILTER (WHERE a.status='absent') AS absences FROM sessions s LEFT JOIN attendance a ON a.session_id=s.id WHERE s.organization_id=$1 AND s.is_active=true GROUP BY TRIM(TO_CHAR(s.session_date,'Day')), EXTRACT(DOW FROM s.session_date) ORDER BY dow`, [orgId]),
      query(`SELECT TO_CHAR(DATE_TRUNC('month', s.session_date),'YYYY-MM') AS month, ROUND(AVG(CASE WHEN a.status IN ('present','justified','late') THEN 100.0 ELSE 0 END),1) AS avg_pct FROM sessions s LEFT JOIN attendance a ON a.session_id=s.id WHERE s.organization_id=$1 AND s.is_active=true GROUP BY DATE_TRUNC('month', s.session_date) ORDER BY month DESC LIMIT 6`, [orgId]),
    ]);

    res.json({
      stats: { ...summary.rows[0], total_sessions: sessions.rows[0].total_sessions, pending_justifications: justif.rows[0].pending, threshold, org_name: org.name },
      atRiskUsers: risk.rows, recentSessions: recentSessions.rows, dayAbsences: dayAbs.rows,
      trend: trend.rows.reverse(),
    });
  } catch (err) { next(err); }
};

// ── GET /api/reports/general ──────────────────────────────────────────────────
const getGeneralReport = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { startDate, endDate, group } = req.query;
    let cond = ['u.organization_id=$1','u.is_active=true','s.is_active=true'];
    let params = [orgId]; let i = 2;
    if (startDate) { cond.push(`s.session_date>=$${i++}`); params.push(startDate); }
    if (endDate)   { cond.push(`s.session_date<=$${i++}`); params.push(endDate); }
    if (group)     { cond.push(`u.group_name=$${i++}`);    params.push(group); }
    const result = await query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.group_name, u.role,
        COUNT(DISTINCT s.id) AS total_sessions,
        COUNT(a.id) FILTER (WHERE a.status='present')   AS present,
        COUNT(a.id) FILTER (WHERE a.status='absent')    AS absent,
        COUNT(a.id) FILTER (WHERE a.status='late')      AS late,
        COUNT(a.id) FILTER (WHERE a.status='justified') AS justified,
        CASE WHEN COUNT(DISTINCT s.id)=0 THEN 0
          ELSE ROUND(COUNT(a.id) FILTER (WHERE a.status IN ('present','justified','late'))::NUMERIC/COUNT(DISTINCT s.id)::NUMERIC*100,1)
        END AS attendance_pct
      FROM users u CROSS JOIN sessions s
      LEFT JOIN attendance a ON a.session_id=s.id AND a.user_id=u.id
      WHERE ${cond.join(' AND ')} AND s.organization_id=$1
      GROUP BY u.id,u.first_name,u.last_name,u.email,u.group_name,u.role
      ORDER BY attendance_pct ASC
    `, params);
    res.json({ report: result.rows });
  } catch (err) { next(err); }
};

// ── GET /api/reports/user/:userId ─────────────────────────────────────────────
const getUserReport = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const orgId = req.user.organization_id;
    if (req.user.role !== 'admin' && req.user.id !== userId) return res.status(403).json({ error:'Sin acceso' });
    const { startDate, endDate } = req.query;
    let dateCond = ''; const params = [userId, orgId];
    if (startDate) dateCond += ` AND s.session_date>=$${params.push(startDate)}`;
    if (endDate)   dateCond += ` AND s.session_date<=$${params.push(endDate)}`;
    const [userInfo, history, summary] = await Promise.all([
      query(`SELECT id,first_name,last_name,email,group_name,role FROM users WHERE id=$1`, [userId]),
      query(`SELECT s.id AS session_id, s.title, s.session_date, s.group_name, COALESCE(a.status,'absent') AS status, a.id AS attendance_id, j.id AS justification_id, j.status AS justification_status, j.reason, j.file_url, j.file_name, j.review_comment FROM sessions s LEFT JOIN attendance a ON a.session_id=s.id AND a.user_id=$1 LEFT JOIN justifications j ON j.session_id=s.id AND j.user_id=$1 AND j.status!='rejected' WHERE s.organization_id=$2 AND s.is_active=true ${dateCond} ORDER BY s.session_date DESC`, params),
      query(`SELECT * FROM v_attendance_summary WHERE user_id=$1`, [userId]),
    ]);
    res.json({ user:userInfo.rows[0], history:history.rows, summary:summary.rows[0] });
  } catch (err) { next(err); }
};

// ── GET /api/reports/session/:id ──────────────────────────────────────────────
const getSessionReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const orgId = req.user.organization_id;
    const [session, attendees] = await Promise.all([
      query(`SELECT * FROM sessions WHERE id=$1 AND organization_id=$2`, [id, orgId]),
      query(`SELECT u.first_name, u.last_name, u.email, u.group_name, u.role, COALESCE(a.status,'absent') AS status, j.status AS justification_status, j.reason FROM users u LEFT JOIN attendance a ON a.session_id=$1 AND a.user_id=u.id LEFT JOIN justifications j ON j.session_id=$1 AND j.user_id=u.id AND j.status!='rejected' WHERE u.organization_id=$2 AND u.is_active=true ORDER BY a.status NULLS LAST, u.first_name`, [id, orgId]),
    ]);
    if (!session.rows[0]) return res.status(404).json({ error:'Sesión no encontrada' });
    const total = attendees.rows.length;
    const present = attendees.rows.filter(a=>['present','justified','late'].includes(a.status)).length;
    res.json({ session:session.rows[0], attendees:attendees.rows, stats:{ total, present, absent:total-present, pct:total?Math.round(present/total*100):0 } });
  } catch (err) { next(err); }
};

// ── GET /api/reports/export/pdf ───────────────────────────────────────────────
const exportPDF = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { type='general', startDate, endDate, sessionId, userId } = req.query;
    const org = await getOrg(orgId);
    const { threshold } = org;

    const doc = new PDFDocument({ margin:30, size:'A4', autoFirstPage:true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=suga-report-${type}-${Date.now()}.pdf`);
    doc.pipe(res);

    if (type === 'general' || !type) {
      // ── GENERAL REPORT ──
      const params = [orgId]; const cond = ['u.organization_id=$1','u.is_active=true','s.is_active=true']; let i=2;
      if (startDate) { cond.push(`s.session_date>=$${i++}`); params.push(startDate); }
      if (endDate)   { cond.push(`s.session_date<=$${i++}`); params.push(endDate); }

      const [data, summary] = await Promise.all([
        query(`SELECT u.first_name||' '||u.last_name AS name, u.email, u.group_name, u.role, COUNT(DISTINCT s.id) AS sessions, COUNT(a.id) FILTER (WHERE a.status='present') AS present, COUNT(a.id) FILTER (WHERE a.status='absent') AS absent, COUNT(a.id) FILTER (WHERE a.status='late') AS late, COUNT(a.id) FILTER (WHERE a.status='justified') AS justified, CASE WHEN COUNT(DISTINCT s.id)=0 THEN 0 ELSE ROUND(COUNT(a.id) FILTER (WHERE a.status IN ('present','justified','late'))::NUMERIC/COUNT(DISTINCT s.id)::NUMERIC*100,1) END AS pct FROM users u CROSS JOIN sessions s LEFT JOIN attendance a ON a.session_id=s.id AND a.user_id=u.id WHERE ${cond.join(' AND ')} AND s.organization_id=$1 GROUP BY u.id,u.first_name,u.last_name,u.email,u.group_name,u.role ORDER BY pct ASC`, params),
        query(`SELECT ROUND(AVG(attendance_pct),1) AS avg, COUNT(*) FILTER (WHERE attendance_pct<$2) AS at_risk, COUNT(*) AS total FROM v_attendance_summary WHERE organization_id=$1`, [orgId, threshold]),
      ]);

      const period = startDate || endDate ? `${startDate||'inicio'} → ${endDate||'hoy'}` : 'Todo el historial';
      pdfHeader(doc, org, 'REPORTE GENERAL', period);

      // Summary KPI row
      const sm = summary.rows[0];
      pdfStat(doc, 30,  doc.y, 'Promedio asistencia', `${parseFloat(sm.avg||0).toFixed(1)}%`, '#00C87A');
      pdfStat(doc, 150, doc.y, 'En riesgo',            sm.at_risk,   '#FF4040');
      pdfStat(doc, 270, doc.y, 'Total miembros',       sm.total,     PDF_ACCENT);
      pdfStat(doc, 390, doc.y, 'Umbral mínimo',        `${threshold}%`, PDF_DIM);
      doc.y += 66;

      // Attendance distribution mini-chart (bar chart using rects)
      const chartX = 30, chartY = doc.y + 8, chartW = doc.page.width - 60, chartH = 48;
      doc.rect(chartX, chartY, chartW, chartH).fillColor(PDF_CARD).fill();
      doc.fontSize(7).font('Helvetica-Bold').fillColor(PDF_DIM).text('DISTRIBUCIÓN DE ASISTENCIA', chartX+8, chartY+6);
      const maxSessions = Math.max(...data.rows.map(r=>parseInt(r.sessions)||1), 1);
      const barW = Math.min(20, (chartW-16) / Math.max(data.rows.length,1) - 3);
      data.rows.forEach((r, i) => {
        const bx = chartX + 8 + i*(barW+3);
        const pct = parseFloat(r.pct||0);
        const bh = Math.max(3, (pct/100) * (chartH-24));
        doc.rect(bx, chartY+chartH-6-bh, barW, bh).fillColor(pctColor(pct,threshold)).fill();
      });
      doc.y = chartY + chartH + 12;

      // Table
      const cols = [
        { key:'name',    label:'Nombre',     x:30,  w:130, bold:true },
        { key:'group_name', label:'Grupo',   x:165, w:70,  type:'dim' },
        { key:'sessions',label:'Ses.',       x:240, w:28,  align:'center' },
        { key:'present', label:'Pres.',      x:272, w:28,  type:'present', align:'center' },
        { key:'absent',  label:'Aus.',       x:304, w:28,  type:'absent',  align:'center' },
        { key:'late',    label:'Tard.',      x:336, w:28,  type:'late',    align:'center' },
        { key:'justified',label:'Just.',     x:368, w:28,  type:'just',    align:'center' },
        { key:'pct',     label:'% Asist.',   x:400, w:48,  type:'pct',     align:'right'  },
      ];
      let rowY = pdfTableHeader(doc, cols, doc.y);
      data.rows.forEach((r, idx) => {
        rowY = pdfTableRow(doc, cols, { ...r, _pct: r.pct }, rowY, idx%2===0, threshold);
      });

    } else if (type === 'session' && sessionId) {
      // ── SESSION REPORT ──
      const [sess, attendees] = await Promise.all([
        query(`SELECT * FROM sessions WHERE id=$1 AND organization_id=$2`, [sessionId, orgId]),
        query(`SELECT u.first_name||' '||u.last_name AS name, u.group_name, u.role, COALESCE(a.status,'absent') AS status, j.status AS just_status, j.reason FROM users u LEFT JOIN attendance a ON a.session_id=$1 AND a.user_id=u.id LEFT JOIN justifications j ON j.session_id=$1 AND j.user_id=u.id AND j.status!='rejected' WHERE u.organization_id=$2 AND u.is_active=true ORDER BY a.status, u.first_name`, [sessionId, orgId]),
      ]);
      const s = sess.rows[0];
      if (!s) { doc.text('Sesión no encontrada'); doc.end(); return; }
      const total = attendees.rows.length;
      const present = attendees.rows.filter(a=>['present','justified','late'].includes(a.status)).length;
      const pct = total ? Math.round(present/total*100) : 0;

      pdfHeader(doc, org, s.title.toUpperCase(), fmtDate(s.session_date, {weekday:'long'}));

      // Big pct stat
      pdfStat(doc, 30,  doc.y, 'Asistencia',       `${pct}%`, pctColor(pct,threshold));
      pdfStat(doc, 150, doc.y, 'Presentes',         present,  '#00C87A');
      pdfStat(doc, 270, doc.y, 'Ausentes',          total-present, '#FF4040');
      pdfStat(doc, 390, doc.y, 'Total convocados',  total,    PDF_ACCENT);
      doc.y += 66;

      // Pie-style visual (two rects)
      const pieY = doc.y + 6;
      const pieW = doc.page.width - 60;
      doc.rect(30, pieY, pieW * (pct/100), 8).fillColor(pctColor(pct,threshold)).fill();
      doc.rect(30 + pieW*(pct/100), pieY, pieW*(1-pct/100), 8).fillColor(PDF_CARD2).fill();
      doc.y = pieY + 20;

      const cols2 = [
        { key:'name',       label:'Nombre',       x:30,  w:160, bold:true },
        { key:'group_name', label:'Grupo',         x:195, w:80,  type:'dim' },
        { key:'role',       label:'Rol',           x:280, w:60,  type:'dim' },
        { key:'status',     label:'Estado',        x:345, w:70  },
        { key:'just_status',label:'Justificación', x:420, w:70, type:'dim' },
      ];
      const statusLabel = {present:'Presente',absent:'Ausente',justified:'Justificado',late:'Tardanza'};
      let rowY2 = pdfTableHeader(doc, cols2, doc.y);
      attendees.rows.forEach((r,idx) => {
        const t = statusLabel[r.status] || r.status;
        const c = {present:'#00C87A',absent:'#FF4040',justified:'#4DA6FF',late:'#F5A623'}[r.status]||PDF_DIM;
        if (rowY2 > doc.page.height-60) { doc.addPage(); doc.rect(0,0,doc.page.width,doc.page.height).fill(PDF_BG); rowY2=40; }
        if (idx%2===0) doc.rect(30,rowY2,doc.page.width-60,22).fillColor('#0F0F0D').fill();
        doc.fontSize(8).font('Helvetica-Bold').fillColor(PDF_TEXT).text(r.name, 30, rowY2+7, {width:160,lineBreak:false});
        doc.font('Helvetica').fillColor(PDF_DIM).text(r.group_name||'—', 195, rowY2+7, {width:80,lineBreak:false});
        doc.text(r.role==='admin'?'Admin':'Miembro', 280, rowY2+7, {width:60,lineBreak:false});
        doc.fillColor(c).font('Helvetica-Bold').text(t, 345, rowY2+7, {width:70,lineBreak:false});
        doc.fillColor(PDF_DIM).font('Helvetica').text(r.just_status||'—', 420, rowY2+7, {width:70,lineBreak:false});
        rowY2+=22;
      });

    } else if (type === 'user' && userId) {
      // ── USER REPORT ──
      const [uInfo, hist, summ] = await Promise.all([
        query(`SELECT * FROM users WHERE id=$1 AND organization_id=$2`, [userId, orgId]),
        query(`SELECT s.title, s.session_date, s.group_name, COALESCE(a.status,'absent') AS status, j.status AS just_status, j.reason FROM sessions s LEFT JOIN attendance a ON a.session_id=s.id AND a.user_id=$1 LEFT JOIN justifications j ON j.session_id=s.id AND j.user_id=$1 AND j.status!='rejected' WHERE s.organization_id=$2 AND s.is_active=true ORDER BY s.session_date DESC`, [userId, orgId]),
        query(`SELECT * FROM v_attendance_summary WHERE user_id=$1`, [userId]),
      ]);
      const u = uInfo.rows[0]; const sm = summ.rows[0];
      if (!u) { doc.text('Usuario no encontrado'); doc.end(); return; }
      const pct2 = parseFloat(sm?.attendance_pct||0);

      pdfHeader(doc, org, `${u.first_name.toUpperCase()} ${u.last_name.toUpperCase()}`,
        `${u.email} · ${u.group_name||'Sin grupo'} · ${u.role==='admin'?'Administrador':'Miembro'}`);

      pdfStat(doc, 30,  doc.y, '% Asistencia', `${pct2.toFixed(1)}%`, pctColor(pct2,threshold));
      pdfStat(doc, 150, doc.y, 'Sesiones',       sm?.total_sessions||0, PDF_ACCENT);
      pdfStat(doc, 270, doc.y, 'Presentes',       sm?.total_present||0,  '#00C87A');
      pdfStat(doc, 390, doc.y, 'Ausentes',        sm?.total_absent||0,   '#FF4040');
      doc.y += 66;

      // Timeline bar
      const tlY = doc.y+6, tlW = doc.page.width-60;
      const total2 = parseInt(sm?.total_sessions||0);
      if (total2 > 0) {
        const pW = (parseInt(sm?.total_present||0)/total2)*tlW;
        const aW = (parseInt(sm?.total_absent||0)/total2)*tlW;
        const lW = (parseInt(sm?.total_late||0)/total2)*tlW;
        const jW = tlW - pW - aW - lW;
        let cx = 30;
        doc.rect(cx, tlY, pW, 10).fillColor('#00C87A').fill(); cx+=pW;
        doc.rect(cx, tlY, lW, 10).fillColor('#F5A623').fill(); cx+=lW;
        doc.rect(cx, tlY, jW, 10).fillColor('#4DA6FF').fill(); cx+=jW;
        doc.rect(cx, tlY, aW, 10).fillColor('#FF4040').fill();
        // legend
        doc.y = tlY+16;
        const legend=[['#00C87A','Presente'],['#F5A623','Tardanza'],['#4DA6FF','Justificado'],['#FF4040','Ausente']];
        let lx=30;
        legend.forEach(([c,l])=>{
          doc.rect(lx,doc.y,8,8).fillColor(c).fill();
          doc.fontSize(7).font('Helvetica').fillColor(PDF_DIM).text(l,lx+11,doc.y,{width:70});
          lx+=82;
        });
        doc.y+=14;
      }

      const cols3=[
        {key:'title',        label:'Sesión',  x:30, w:180, bold:true},
        {key:'session_date', label:'Fecha',   x:215,w:80,  type:'dim'},
        {key:'group_name',   label:'Grupo',   x:300,w:70,  type:'dim'},
        {key:'status',       label:'Estado',  x:375,w:80},
        {key:'just_status',  label:'Justif.', x:460,w:60, type:'dim'},
      ];
      const sLabel={present:'Presente',absent:'Ausente',justified:'Justificado',late:'Tardanza'};
      let rowY3=pdfTableHeader(doc,cols3,doc.y);
      hist.rows.forEach((r,idx)=>{
        if(rowY3>doc.page.height-60){doc.addPage();doc.rect(0,0,doc.page.width,doc.page.height).fill(PDF_BG);rowY3=40;}
        if(idx%2===0) doc.rect(30,rowY3,doc.page.width-60,22).fillColor('#0F0F0D').fill();
        const sc={present:'#00C87A',absent:'#FF4040',justified:'#4DA6FF',late:'#F5A623'}[r.status]||PDF_DIM;
        doc.fontSize(8).font('Helvetica-Bold').fillColor(PDF_TEXT).text(r.title.slice(0,28),30,rowY3+7,{width:180,lineBreak:false});
        doc.font('Helvetica').fillColor(PDF_DIM).text(fmtDate(r.session_date),215,rowY3+7,{width:80,lineBreak:false});
        doc.text(r.group_name||'—',300,rowY3+7,{width:70,lineBreak:false});
        doc.fillColor(sc).font('Helvetica-Bold').text(sLabel[r.status]||r.status,375,rowY3+7,{width:80,lineBreak:false});
        doc.fillColor(PDF_DIM).font('Helvetica').text(r.just_status||'—',460,rowY3+7,{width:60,lineBreak:false});
        rowY3+=22;
      });
    }

    pdfFooter(doc);
    doc.end();
  } catch (err) { next(err); }
};

// ── GET /api/reports/export/excel ─────────────────────────────────────────────
const exportExcel = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { type='general', startDate, endDate, sessionId, userId } = req.query;
    const org = await getOrg(orgId);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'SUGA'; wb.created = new Date();
    wb.properties.date1904 = false;

    // ── Style helpers ──
    const DARK  = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF0A0A08' } };
    const CARD  = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF111110' } };
    const CARD2 = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF1C1C1A' } };
    const ROW_ODD  = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF0F0F0D' } };
    const ROW_EVEN = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF111110' } };

    const headerFont = { bold:true, color:{ argb:'FFFFFFF2E8' }, size:11 };
    const subFont    = { color:{ argb:'FF9C9A90' }, size:9 };
    const monoFont   = { name:'Courier New', size:9 };
    const goColor    = 'FFC8FF00';
    const dimColor   = 'FF5C5A52';

    const pctFill = (pct) => {
      const p = parseFloat(pct||0);
      if (p >= org.threshold+10) return { type:'pattern', pattern:'solid', fgColor:{ argb:'FF00200F' } };
      if (p >= org.threshold)    return { type:'pattern', pattern:'solid', fgColor:{ argb:'FF1A0A00' } };
      return                            { type:'pattern', pattern:'solid', fgColor:{ argb:'FF200005' } };
    };
    const pctFont = (pct) => {
      const p = parseFloat(pct||0);
      const c = p >= org.threshold+10 ? 'FF00C87A' : p >= org.threshold ? 'FFF5A623' : 'FFFF4040';
      return { bold:true, color:{ argb:c }, size:10 };
    };

    const addSheetHeader = (ws, title, subtitle) => {
      ws.getRow(1).height = 40;
      ws.mergeCells('A1:J1');
      const hCell = ws.getCell('A1');
      hCell.value = title;
      hCell.font  = { name:'Arial', bold:true, size:18, color:{ argb:goColor } };
      hCell.fill  = DARK;
      hCell.alignment = { vertical:'middle', horizontal:'left', indent:1 };

      ws.getRow(2).height = 18;
      ws.mergeCells('A2:J2');
      const sCell = ws.getCell('A2');
      sCell.value = subtitle;
      sCell.font  = { ...monoFont, color:{ argb:dimColor } };
      sCell.fill  = CARD;
      sCell.alignment = { vertical:'middle', horizontal:'left', indent:1 };
    };

    if (type === 'general' || !type) {
      const ws = wb.addWorksheet('Reporte General', { properties:{ tabColor:{ argb:goColor } } });
      ws.views = [{ state:'frozen', ySplit:4 }];

      const params=[orgId]; const cond=['u.organization_id=$1','u.is_active=true','s.is_active=true']; let i2=2;
      if(startDate){cond.push(`s.session_date>=$${i2++}`);params.push(startDate);}
      if(endDate)  {cond.push(`s.session_date<=$${i2++}`);params.push(endDate);}
      const data = await query(`SELECT u.first_name||' '||u.last_name AS nombre, u.email, u.group_name AS grupo, u.role AS rol, COUNT(DISTINCT s.id) AS sesiones, COUNT(a.id) FILTER (WHERE a.status='present') AS presentes, COUNT(a.id) FILTER (WHERE a.status='absent') AS ausentes, COUNT(a.id) FILTER (WHERE a.status='late') AS tardanzas, COUNT(a.id) FILTER (WHERE a.status='justified') AS justificados, CASE WHEN COUNT(DISTINCT s.id)=0 THEN 0 ELSE ROUND(COUNT(a.id) FILTER (WHERE a.status IN ('present','justified','late'))::NUMERIC/COUNT(DISTINCT s.id)::NUMERIC*100,1) END AS pct FROM users u CROSS JOIN sessions s LEFT JOIN attendance a ON a.session_id=s.id AND a.user_id=u.id WHERE ${cond.join(' AND ')} AND s.organization_id=$1 GROUP BY u.id,u.first_name,u.last_name,u.email,u.group_name,u.role ORDER BY pct ASC`, params);

      addSheetHeader(ws, 'REPORTE GENERAL DE ASISTENCIA', `${org.name} · Período: ${startDate||'inicio'} → ${endDate||'hoy'} · Umbral: ${org.threshold}%`);

      ws.columns = [
        {key:'nombre',       width:28}, {key:'email',        width:30},
        {key:'grupo',        width:16}, {key:'rol',          width:12},
        {key:'sesiones',     width:11}, {key:'presentes',    width:11},
        {key:'ausentes',     width:11}, {key:'tardanzas',    width:11},
        {key:'justificados', width:13}, {key:'pct',          width:14},
      ];

      const hRow = ws.getRow(4);
      ['Nombre','Email','Grupo','Rol','Sesiones','Presentes','Ausentes','Tardanzas','Justificados','% Asistencia'].forEach((h,j)=>{
        const cell = hRow.getCell(j+1);
        cell.value = h; cell.font = { bold:true, color:{ argb:dimColor }, size:9 };
        cell.fill  = CARD2;
        cell.border = { bottom:{ style:'thin', color:{ argb:'FF272724' } } };
        cell.alignment = { vertical:'middle', horizontal:'center' };
      });
      hRow.height = 20;

      data.rows.forEach((r,idx)=>{
        const row = ws.addRow([r.nombre,r.email,r.grupo,r.rol==='admin'?'Admin':'Miembro',r.sesiones,r.presentes,r.ausentes,r.tardanzas,r.justificados,`${r.pct}%`]);
        row.height = 18;
        const bg = idx%2===0 ? ROW_EVEN : ROW_ODD;
        row.eachCell(c=>{ c.fill = bg; c.alignment={vertical:'middle',horizontal:'center'}; c.font={color:{argb:'FF9C9A90'},size:9}; });
        // Name styling
        const nc = row.getCell(1); nc.font={bold:true,color:{argb:'FFF2F0E8'},size:9}; nc.alignment={...nc.alignment,horizontal:'left'};
        // Pct cell
        const pc = row.getCell(10);
        pc.fill = pctFill(r.pct); pc.font = pctFont(r.pct);
        // Color cells
        row.getCell(6).font = {bold:true,color:{argb:'FF00C87A'},size:9};
        row.getCell(7).font = {bold:true,color:{argb:'FFFF4040'},size:9};
        row.getCell(8).font = {bold:true,color:{argb:'FFF5A623'},size:9};
        row.getCell(9).font = {bold:true,color:{argb:'FF4DA6FF'},size:9};
      });

      ws.autoFilter = { from:'A4', to:'J4' };

    } else if (type === 'session' && sessionId) {
      const ws = wb.addWorksheet('Por Sesión', { properties:{ tabColor:{ argb:goColor } } });
      ws.views = [{ state:'frozen', ySplit:4 }];
      const [sess, att] = await Promise.all([
        query(`SELECT * FROM sessions WHERE id=$1 AND organization_id=$2`,[sessionId,orgId]),
        query(`SELECT u.first_name||' '||u.last_name AS nombre, u.email, u.group_name AS grupo, u.role AS rol, COALESCE(a.status,'absent') AS estado, j.status AS justificacion, j.reason AS motivo FROM users u LEFT JOIN attendance a ON a.session_id=$1 AND a.user_id=u.id LEFT JOIN justifications j ON j.session_id=$1 AND j.user_id=u.id AND j.status!='rejected' WHERE u.organization_id=$2 AND u.is_active=true ORDER BY a.status,u.first_name`,[sessionId,orgId]),
      ]);
      const s = sess.rows[0];
      addSheetHeader(ws, s?.title?.toUpperCase()||'SESIÓN', `${fmtDate(s?.session_date)} · ${s?.group_name} · ${org.name}`);
      ws.columns = [{key:'nombre',width:28},{key:'email',width:30},{key:'grupo',width:16},{key:'rol',width:12},{key:'estado',width:14},{key:'justificacion',width:14},{key:'motivo',width:40}];
      const hRow = ws.getRow(4);
      ['Nombre','Email','Grupo','Rol','Estado','Justificación','Motivo'].forEach((h,j)=>{
        const c=hRow.getCell(j+1); c.value=h; c.font={bold:true,color:{argb:dimColor},size:9}; c.fill=CARD2; c.alignment={vertical:'middle',horizontal:'center'};
        c.border={bottom:{style:'thin',color:{argb:'FF272724'}}};
      });
      hRow.height=20;
      att.rows.forEach((r,idx)=>{
        const row = ws.addRow([r.nombre,r.email,r.grupo,r.rol==='admin'?'Admin':'Miembro',r.estado,r.justificacion||'—',r.motivo||'']);
        row.height=18;
        row.eachCell(c=>{c.fill=idx%2===0?ROW_EVEN:ROW_ODD;c.alignment={vertical:'middle',horizontal:'center'};c.font={color:{argb:'FF9C9A90'},size:9};});
        row.getCell(1).font={bold:true,color:{argb:'FFF2F0E8'},size:9};
        const ec={present:'FF00C87A',absent:'FFFF4040',justified:'FF4DA6FF',late:'FFF5A623'}[r.estado];
        if(ec) row.getCell(5).font={bold:true,color:{argb:ec},size:9};
      });

    } else if (type === 'user' && userId) {
      const ws = wb.addWorksheet('Historial', { properties:{ tabColor:{ argb:goColor } } });
      ws.views = [{ state:'frozen', ySplit:4 }];
      const [uInfo, hist, smm] = await Promise.all([
        query(`SELECT * FROM users WHERE id=$1 AND organization_id=$2`,[userId,orgId]),
        query(`SELECT s.title AS sesion, s.session_date AS fecha, s.group_name AS grupo, COALESCE(a.status,'absent') AS estado, j.status AS justificacion, j.reason AS motivo FROM sessions s LEFT JOIN attendance a ON a.session_id=s.id AND a.user_id=$1 LEFT JOIN justifications j ON j.session_id=s.id AND j.user_id=$1 AND j.status!='rejected' WHERE s.organization_id=$2 AND s.is_active=true ORDER BY s.session_date DESC`,[userId,orgId]),
        query(`SELECT * FROM v_attendance_summary WHERE user_id=$1`,[userId]),
      ]);
      const u=uInfo.rows[0]; const sm2=smm.rows[0]; const pct3=parseFloat(sm2?.attendance_pct||0);
      addSheetHeader(ws, `${u?.first_name?.toUpperCase()} ${u?.last_name?.toUpperCase()}`, `${u?.email} · ${u?.group_name||'Sin grupo'} · Asistencia: ${pct3.toFixed(1)}% · Umbral: ${org.threshold}%`);
      ws.columns=[{key:'sesion',width:34},{key:'fecha',width:14},{key:'grupo',width:16},{key:'estado',width:14},{key:'justificacion',width:14},{key:'motivo',width:40}];
      const hRow=ws.getRow(4);
      ['Sesión','Fecha','Grupo','Estado','Justificación','Motivo'].forEach((h,j)=>{
        const c=hRow.getCell(j+1); c.value=h; c.font={bold:true,color:{argb:dimColor},size:9}; c.fill=CARD2; c.alignment={vertical:'middle',horizontal:'center'};
        c.border={bottom:{style:'thin',color:{argb:'FF272724'}}};
      });
      hRow.height=20;
      hist.rows.forEach((r,idx)=>{
        const row=ws.addRow([r.sesion,new Date(r.fecha+'T12:00').toLocaleDateString('es-CO'),r.grupo,r.estado,r.justificacion||'—',r.motivo||'']);
        row.height=18;
        row.eachCell(c=>{c.fill=idx%2===0?ROW_EVEN:ROW_ODD;c.alignment={vertical:'middle',horizontal:'center'};c.font={color:{argb:'FF9C9A90'},size:9};});
        row.getCell(1).font={bold:true,color:{argb:'FFF2F0E8'},size:9}; row.getCell(1).alignment.horizontal='left';
        const ec={present:'FF00C87A',absent:'FFFF4040',justified:'FF4DA6FF',late:'FFF5A623'}[r.estado];
        if(ec) row.getCell(4).font={bold:true,color:{argb:ec},size:9};
      });
    }

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename=suga-report-${type}-${Date.now()}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
};

// ── Notifications ─────────────────────────────────────────────────────────────
const getNotifications = async (req,res,next) => {
  try {
    const r = await query(`SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30`, [req.user.id]);
    res.json({ notifications: r.rows });
  } catch(err){next(err);}
};
const markNotificationsRead = async (req,res,next) => {
  try {
    await query(`UPDATE notifications SET read=true WHERE user_id=$1`, [req.user.id]);
    res.json({ message:'Notificaciones leídas' });
  } catch(err){next(err);}
};

module.exports = { getDashboardStats, getGeneralReport, getUserReport, getSessionReport, exportPDF, exportExcel, getNotifications, markNotificationsRead };
