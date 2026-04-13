import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { reportsAPI, usersAPI, sessionsAPI, downloadFile } from '../services/api';
import { PageHeader, ProgressBar, Badge, Spinner, Alert } from '../components/ui';

export default function Reports() {
  const [reportType, setReportType] = useState('general');
  const [selectedUserId, setSelectedUserId]     = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [exporting, setExporting] = useState(false);

  const { data: usersData }    = useQuery({ queryKey:['users-list'],    queryFn:()=>usersAPI.getAll().then(r=>r.data) });
  const { data: sessionsData } = useQuery({ queryKey:['sessions-list'], queryFn:()=>sessionsAPI.getAll().then(r=>r.data) });

  const { data: generalData, isLoading: loadingGeneral } = useQuery({
    queryKey: ['report-general', startDate, endDate],
    queryFn: () => reportsAPI.general({ startDate: startDate||undefined, endDate: endDate||undefined }).then(r=>r.data),
    enabled: reportType === 'general',
  });

  const { data: userReport, isLoading: loadingUser } = useQuery({
    queryKey: ['report-user', selectedUserId],
    queryFn: () => reportsAPI.user(selectedUserId).then(r=>r.data),
    enabled: reportType === 'user' && !!selectedUserId,
  });

  const { data: sessionReport, isLoading: loadingSession } = useQuery({
    queryKey: ['report-session', selectedSessionId],
    queryFn: () => reportsAPI.session(selectedSessionId).then(r=>r.data),
    enabled: reportType === 'session' && !!selectedSessionId,
  });

  // Build export params based on current view
  const getExportParams = () => {
    if (reportType === 'general') return { type:'general', startDate: startDate||undefined, endDate: endDate||undefined };
    if (reportType === 'user')    return { type:'user', userId: selectedUserId };
    if (reportType === 'session') return { type:'session', sessionId: selectedSessionId };
    return { type:'general' };
  };

  const handleExport = async (format) => {
    const params = getExportParams();
    if (reportType === 'user' && !params.userId)       { toast.error('Selecciona un usuario primero'); return; }
    if (reportType === 'session' && !params.sessionId) { toast.error('Selecciona una sesión primero'); return; }

    setExporting(true);
    try {
      let blob, filename;
      if (format === 'pdf') {
        const r = await reportsAPI.exportPDF(params);
        blob = r.data;
        filename = `reporte-suga-${Date.now()}.pdf`;
      } else {
        const r = await reportsAPI.exportExcel(params);
        blob = r.data;
        filename = `reporte-suga-${Date.now()}.xlsx`;
      }
      downloadFile(blob, filename);
      toast.success(`Reporte ${format.toUpperCase()} descargado`);
    } catch(e) {
      toast.error('Error al generar el reporte');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader title="Reportes" subtitle="Genera y exporta reportes detallados en PDF o Excel">
        <button className="btn-ghost text-sm" onClick={()=>handleExport('excel')} disabled={exporting}>
          {exporting ? '...' : '📊 Excel'}
        </button>
        <button className="btn-primary text-sm" onClick={()=>handleExport('pdf')} disabled={exporting}>
          {exporting ? 'Generando...' : '📄 PDF'}
        </button>
      </PageHeader>

      {/* Report type selector */}
      <div className="grid grid-cols-3 gap-4 mb-7">
        {[
          { key:'general', icon:'📆', title:'Por período',  desc:'Consolidado de todos los usuarios en un rango de fechas' },
          { key:'user',    icon:'👤', title:'Por persona',  desc:'Historial completo de un usuario específico' },
          { key:'session', icon:'📅', title:'Por sesión',   desc:'Lista de asistentes y estado de una sesión' },
        ].map(t => (
          <div key={t.key} onClick={()=>setReportType(t.key)}
            className="card cursor-pointer transition-all"
            style={{ border: reportType===t.key ? '1px solid var(--accent)' : '1px solid var(--border)', background: reportType===t.key ? 'var(--accent3)' : 'var(--bg2)' }}>
            <div className="text-2xl mb-2">{t.icon}</div>
            <div className="font-display font-bold text-sm mb-1">{t.title}</div>
            <div className="text-xs" style={{ color:'var(--text3)' }}>{t.desc}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex gap-4 flex-wrap items-end">
          {reportType === 'general' && (
            <>
              <div>
                <label className="label">Desde</label>
                <input className="input" type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Hasta</label>
                <input className="input" type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} />
              </div>
              <p className="text-xs self-end pb-2.5" style={{ color:'var(--text3)' }}>Si dejas vacío muestra todo el historial</p>
            </>
          )}
          {reportType === 'user' && (
            <div style={{ minWidth:240 }}>
              <label className="label">Seleccionar usuario</label>
              <select className="input" value={selectedUserId} onChange={e=>setSelectedUserId(e.target.value)}>
                <option value="">— Elige un usuario —</option>
                {usersData?.users?.map(u=>(
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name} ({u.role==='admin'?'Admin':'Miembro'}) · {u.group_name||'Sin grupo'}
                  </option>
                ))}
              </select>
            </div>
          )}
          {reportType === 'session' && (
            <div style={{ minWidth:280 }}>
              <label className="label">Seleccionar sesión</label>
              <select className="input" value={selectedSessionId} onChange={e=>setSelectedSessionId(e.target.value)}>
                <option value="">— Elige una sesión —</option>
                {sessionsData?.sessions?.map(s=>(
                  <option key={s.id} value={s.id}>
                    {s.title} — {new Date(s.session_date).toLocaleDateString('es-CO')}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <button className="btn-ghost text-sm" onClick={()=>handleExport('excel')} disabled={exporting}>Excel</button>
            <button className="btn-primary text-sm" onClick={()=>handleExport('pdf')} disabled={exporting}>
              {exporting ? 'Generando...' : 'PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* ── General report ── */}
      {reportType === 'general' && (
        loadingGeneral ? <Spinner/> : (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-sm">
                Reporte general {startDate ? `· ${startDate} → ${endDate||'hoy'}` : '· Todo el historial'}
              </h3>
              <span className="chip text-xs">{generalData?.report?.length||0} usuarios</span>
            </div>
            <table className="table-auto">
              <thead><tr>
                <th>Nombre</th><th>Grupo</th><th>Rol</th>
                <th>Sesiones</th><th>Presentes</th><th>Ausentes</th><th>Just.</th><th>% Asistencia</th>
              </tr></thead>
              <tbody>
                {generalData?.report?.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="font-medium text-sm" style={{ color:'var(--text)' }}>{u.first_name} {u.last_name}</div>
                      <div className="text-xs" style={{ color:'var(--text3)' }}>{u.email}</div>
                    </td>
                    <td><span className="chip text-xs">{u.group_name||'—'}</span></td>
                    <td><Badge status={u.role}/></td>
                    <td className="font-display font-semibold text-center">{u.total_sessions}</td>
                    <td className="font-semibold text-center" style={{ color:'var(--green)' }}>{u.present}</td>
                    <td className="font-semibold text-center" style={{ color:'var(--red)' }}>{u.absent}</td>
                    <td className="font-semibold text-center" style={{ color:'var(--purple)' }}>{u.justified}</td>
                    <td style={{ minWidth:160 }}><ProgressBar value={parseFloat(u.attendance_pct||0)}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── User report ── */}
      {reportType === 'user' && selectedUserId && (
        loadingUser ? <Spinner/> : userReport && (
          <div className="space-y-5">
            <div className="card">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-full flex items-center justify-center font-display font-black text-xl"
                  style={{ background:'linear-gradient(135deg,var(--accent),var(--purple))', color:'white' }}>
                  {userReport.user?.first_name?.[0]}{userReport.user?.last_name?.[0]}
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg">{userReport.user?.first_name} {userReport.user?.last_name}</h3>
                  <div className="text-sm" style={{ color:'var(--text3)' }}>
                    {userReport.user?.email} · {userReport.user?.group_name||'Sin grupo'}
                    {' · '}<Badge status={userReport.user?.role}/>
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <div className="font-display font-black text-4xl" style={{
                    color: parseFloat(userReport.summary?.attendance_pct)>=85?'var(--green)'
                          :parseFloat(userReport.summary?.attendance_pct)>=75?'var(--amber)':'var(--red)' }}>
                    {parseFloat(userReport.summary?.attendance_pct||0).toFixed(1)}%
                  </div>
                  <div className="text-xs" style={{ color:'var(--text3)' }}>asistencia total</div>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-3">
                {[
                  { l:'Total sesiones', v:userReport.summary?.total_sessions, c:'text' },
                  { l:'Presentes',      v:userReport.summary?.total_present,  c:'green' },
                  { l:'Ausentes',       v:userReport.summary?.total_absent,   c:'red' },
                  { l:'Tardanzas',      v:userReport.summary?.total_late,     c:'amber' },
                  { l:'Justificados',   v:userReport.summary?.total_justified,c:'purple' },
                ].map(s=>(
                  <div key={s.l} className="text-center rounded-lg p-3" style={{ background:'var(--bg3)' }}>
                    <div className="font-display font-black text-2xl" style={{ color:`var(--${s.c})` }}>{s.v||0}</div>
                    <div className="text-xs mt-1" style={{ color:'var(--text3)' }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <h3 className="font-display font-bold text-sm mb-4">Historial de sesiones</h3>
              <table className="table-auto">
                <thead><tr><th>Sesión</th><th>Grupo</th><th>Fecha</th><th>Estado</th><th>Justificación</th></tr></thead>
                <tbody>
                  {userReport.history?.map((h,i)=>(
                    <tr key={i}>
                      <td style={{ color:'var(--text)', fontWeight:500 }}>{h.title}</td>
                      <td><span className="chip text-xs">{h.group_name}</span></td>
                      <td className="text-xs">{new Date(h.session_date).toLocaleDateString('es-CO')}</td>
                      <td><Badge status={h.status}/></td>
                      <td>{h.justification_status ? <Badge status={h.justification_status}/> : <span style={{ color:'var(--text3)' }}>—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ── Session report ── */}
      {reportType === 'session' && selectedSessionId && (
        loadingSession ? <Spinner/> : sessionReport && (
          <div className="card">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-display font-bold text-lg">{sessionReport.session?.title}</h3>
                <div className="text-sm mt-0.5" style={{ color:'var(--text3)' }}>
                  {new Date(sessionReport.session?.session_date).toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})}
                  {' · '}{sessionReport.session?.group_name}
                </div>
              </div>
              <div className="text-right">
                <div className="font-display font-black text-4xl" style={{ color: sessionReport.stats?.pct>=75?'var(--green)':'var(--red)' }}>
                  {sessionReport.stats?.pct}%
                </div>
                <div className="text-xs" style={{ color:'var(--text3)' }}>
                  {sessionReport.stats?.present}/{sessionReport.stats?.total} presentes
                </div>
              </div>
            </div>
            <table className="table-auto">
              <thead><tr><th>Nombre</th><th>Rol</th><th>Grupo</th><th>Estado</th><th>Justificación</th></tr></thead>
              <tbody>
                {sessionReport.attendees?.map((a,i)=>(
                  <tr key={i}>
                    <td style={{ color:'var(--text)', fontWeight:500 }}>{a.first_name} {a.last_name}</td>
                    <td><Badge status={a.role}/></td>
                    <td><span className="chip text-xs">{a.group_name||'—'}</span></td>
                    <td><Badge status={a.status}/></td>
                    <td>{a.justification_status ? <Badge status={a.justification_status}/> : <span style={{ color:'var(--text3)' }}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
