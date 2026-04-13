import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { reportsAPI } from '../services/api';
import { PageHeader, StatCard, ProgressBar, Alert, Spinner } from '../components/ui';

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs"
      style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)' }}>
      <div style={{ color:'var(--text3)', marginBottom:3 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color }}>{p.name}: {p.value}{p.name?.includes('%')||typeof p.value==='number'&&p.name==='pct'?'%':''}</div>)}
    </div>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  
  // ── NUEVO: Test de conexión al backend de Render ──
  const [backendStatus, setBackendStatus] = useState('Conectando...');
  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'https://suga-1-vrqy.onrender.com';
    fetch(`${apiUrl}/health`)
      .then(res => res.json())
      .then(data => {
        console.log('✅ Backend conectado:', data);
        setBackendStatus(`✅ ${data.app} online`);
      })
      .catch(err => {
        console.error('❌ Error backend:', err);
        setBackendStatus('❌ Backend sin conexión');
      });
  }, []);
  // ──────────────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => reportsAPI.dashboard().then(r => r.data),
    refetchInterval: 60_000,
  });

  if (isLoading) return <Spinner />;
  const { stats, atRiskUsers = [], recentSessions = [], dayAbsences = [] } = data || {};

  const sparkGreen  = [72,75,78,80,82,80,84,86,88, parseFloat(stats?.avg_attendance||80)];
  const sparkRed    = [1,2,1,3,2,3,3,2,2, stats?.at_risk_count||0];
  const sparkAmber  = [0,1,1,2,1,3,2,3,3, stats?.pending_justifications||0];
  const sparkBlue   = [1,1,2,2,2,3,3,4,4, parseInt(stats?.total_sessions||0)];

  const sessionChartData = recentSessions.map(s => ({
    name: s.title.split(' ').slice(0,2).join(' '),
    pct: parseFloat(s.pct),
  }));

  const dayChartData = dayAbsences.map(d => ({
    dia: d.day?.slice(0,3) || '?',
    ausencias: parseInt(d.absences),
  }));

  return (
    <div>
      {/* Banner de estado del backend */}
      <div className="mb-3 text-xs" style={{ color: backendStatus.includes('✅') ? 'var(--green)' : 'var(--red)' }}>
        {backendStatus}
      </div>

      <PageHeader
        title={`Hola, ${stats?.org_name || 'SUGA'} 👋`}
        subtitle={new Date().toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
      >
        <button className="btn-ghost text-sm" onClick={() => navigate('/reports')}>Ver reportes</button>
        <button className="btn-primary text-sm" onClick={() => navigate('/sessions')}>+ Nueva sesión</button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-7">
        <StatCard label="Asistencia promedio" value={`${stats?.avg_attendance||0}%`}
          color="green" sub="↑ Acumulado" sparkData={sparkGreen} />
        <StatCard label="En riesgo" value={stats?.at_risk_count||0}
          color="red" sub={`Umbral: ${stats?.threshold||75}%`} sparkData={sparkRed} />
        <StatCard label="Justificaciones" value={stats?.pending_justifications||0}
          color="amber" sub="Pendientes revisión" sparkData={sparkAmber} />
        <StatCard label="Sesiones del mes" value={stats?.total_sessions||0}
          color="blue" sub="Este mes" sparkData={sparkBlue} />
      </div>

      {/* Alerts */}
      {atRiskUsers.length > 0 && (
        <div className="space-y-2 mb-7">
          {atRiskUsers.map(u => (
            <Alert key={u.user_id} type="danger">
              <span>🚨</span>
              <span>
                <strong>{u.first_name} {u.last_name}</strong>
                {u.role === 'admin' && <span className="ml-1 badge badge-purple" style={{fontSize:9}}>Admin</span>}
                {' '}— Asistencia {parseFloat(u.attendance_pct).toFixed(1)}%
                (mínimo: {stats?.threshold}%) · {u.total_absent} ausencias
                {u.group_name && ` · ${u.group_name}`}
              </span>
            </Alert>
          ))}
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-bold text-sm">Asistencia por sesión</h2>
            <span className="chip text-xs">Últimas {recentSessions.length}</span>
          </div>
          {sessionChartData.length ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={sessionChartData} barSize={22}>
                <XAxis dataKey="name" tick={{ fill:'var(--text3)', fontSize:9 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0,100]} tick={{ fill:'var(--text3)', fontSize:9 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill:'rgba(108,92,231,0.08)' }} />
                <Bar dataKey="pct" name="%" radius={[4,4,0,0]}>
                  {sessionChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.pct>=85?'var(--green)':entry.pct>=75?'var(--amber)':'var(--red)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-sm" style={{ color:'var(--text3)' }}>
              Sin sesiones aún
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-bold text-sm">Ausencias por día</h2>
            <span className="chip text-xs">Distribución</span>
          </div>
          {dayChartData.length ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dayChartData} barSize={26}>
                <XAxis dataKey="dia" tick={{ fill:'var(--text3)', fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:'var(--text3)', fontSize:9 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill:'rgba(255,77,109,0.08)' }} />
                <Bar dataKey="ausencias" name="Ausencias" radius={[4,4,0,0]}>
                  {dayChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.ausencias>=3?'var(--red)':entry.ausencias>=2?'var(--amber)':'var(--green)'} opacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-sm" style={{ color:'var(--text3)' }}>
              Sin datos
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Recent sessions */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-sm">Últimas sesiones</h2>
            <button className="btn-ghost text-xs py-1 px-3" onClick={() => navigate('/sessions')}>Ver todas</button>
          </div>
          <table className="table-auto">
            <thead><tr><th>Sesión</th><th>Fecha</th><th>Asistencia</th></tr></thead>
            <tbody>
              {recentSessions.map(s => (
                <tr key={s.id} className="cursor-pointer"
                  onClick={() => navigate(`/sessions/${s.id}/attendance`)}>
                  <td>
                    <div className="font-medium text-sm" style={{ color:'var(--text)' }}>{s.title}</div>
                    <div className="text-xs" style={{ color:'var(--text3)' }}>{s.group_name}</div>
                  </td>
                  <td className="text-xs">
                    {new Date(s.session_date+'T12:00').toLocaleDateString('es-CO',{ day:'numeric', month:'short' })}
                  </td>
                  <td style={{ minWidth:130 }}>
                    <ProgressBar value={parseFloat(s.pct||0)} />
                  </td>
                </tr>
              ))}
              {!recentSessions.length && (
                <tr><td colSpan={3} className="text-center py-6" style={{ color:'var(--text3)' }}>Sin sesiones</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* At-risk users */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-sm">Usuarios en riesgo</h2>
            {atRiskUsers.length > 0 && <span className="badge badge-red">{atRiskUsers.length}</span>}
          </div>
          {atRiskUsers.length ? (
            <div className="space-y-3">
              {atRiskUsers.map(u => (
                <div key={u.user_id} className="flex items-center gap-3"
                  style={{ borderLeft:'3px solid var(--red)', paddingLeft:12 }}>
                  <div className="flex-1">
                    <div className="text-sm font-medium flex items-center gap-1" style={{ color:'var(--text)' }}>
                      {u.first_name} {u.last_name}
                      {u.role === 'admin' && <span className="badge badge-purple" style={{fontSize:9}}>Admin</span>}
                    </div>
                    <div className="text-xs" style={{ color:'var(--text3)' }}>
                      {u.total_absent} ausencias{u.group_name ? ` · ${u.group_name}` : ''}
                    </div>
                  <div className="font-display font-black text-xl" style={{ color:'var(--red)' }}>
                    {parseFloat(u.attendance_pct||0).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm" style={{ color:'var(--text3)' }}>
              ✓ Todos sobre el umbral de {stats?.threshold}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}