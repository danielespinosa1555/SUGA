import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { reportsAPI, attendanceAPI } from '../services/api';
import { PageHeader, StatCard, ProgressBar, Spinner } from '../components/ui';

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs"
      style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)' }}>
      <div style={{ color:'var(--text3)', marginBottom:3 }}>{label}</div>
      {payload.map((p,i)=><div key={i} style={{ color:p.fill||p.color }}>{p.name}: {p.value}</div>)}
    </div>
  );
};

export default function Analytics() {
  const { data: dash, isLoading } = useQuery({
    queryKey:['dashboard'],
    queryFn:()=>reportsAPI.dashboard().then(r=>r.data),
  });
  const { data: summaryData } = useQuery({
    queryKey:['attendance-summary'],
    queryFn:()=>attendanceAPI.getSummary().then(r=>r.data),
  });

  if (isLoading) return <Spinner />;
  const { stats, recentSessions=[], dayAbsences=[] } = dash||{};
  const users    = summaryData?.users || [];
  const threshold = summaryData?.threshold || 75;

  const atRisk  = users.filter(u => parseFloat(u.attendance_pct) < threshold).length;
  const atWarn  = users.filter(u => { const p=parseFloat(u.attendance_pct); return p>=threshold && p<threshold+10; }).length;
  const atOk    = users.filter(u => parseFloat(u.attendance_pct) >= threshold+10).length;

  const pieData = [
    { name:'En riesgo', value:atRisk, fill:'var(--red)' },
    { name:'Alerta',    value:atWarn, fill:'var(--amber)' },
    { name:'OK',        value:atOk,   fill:'var(--green)' },
  ].filter(d=>d.value>0);

  const sorted = [...users].sort((a,b)=>parseFloat(a.attendance_pct)-parseFloat(b.attendance_pct));

  const sessionChartData = recentSessions.map(s=>({
    name: s.title.split(' ').slice(0,2).join(' '),
    asistencia: parseFloat(s.pct),
    ausentes: 100 - parseFloat(s.pct),
  }));

  const dayChartData = dayAbsences.map(d=>({
    dia: d.day?.slice(0,3)||'?',
    ausencias: parseInt(d.absences),
  }));

  return (
    <div>
      <PageHeader title="Analítica" subtitle="KPIs y análisis de asistencia en profundidad" />

      <div className="grid grid-cols-4 gap-4 mb-7">
        <StatCard label="Asistencia global"   value={`${stats?.avg_attendance||0}%`} color="green" />
        <StatCard label="Usuarios totales"    value={users.length}                    color="blue" />
        <StatCard label="En riesgo"           value={atRisk}                          color="red"   sub={`< ${threshold}%`} />
        <StatCard label="Justificaciones pend." value={stats?.pending_justifications||0} color="amber" />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Sessions trend */}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-bold text-sm">Tendencia por sesión</h3>
            <span className="chip text-xs">últimas {recentSessions.length}</span>
          </div>
          {sessionChartData.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sessionChartData} barSize={18}>
                <XAxis dataKey="name" tick={{ fill:'var(--text3)', fontSize:9 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0,100]} tick={{ fill:'var(--text3)', fontSize:9 }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} cursor={{ fill:'rgba(108,92,231,0.08)' }} />
                <Bar dataKey="asistencia" name="Asistencia" fill="var(--accent)" radius={[4,4,0,0]} />
                <Bar dataKey="ausentes"   name="Ausencias"  fill="var(--red-bg)" radius={[4,4,0,0]} opacity={0.6} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm" style={{ color:'var(--text3)' }}>Sin sesiones</div>
          )}
        </div>

        {/* Day absences */}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-bold text-sm">Ausencias por día</h3>
            <span className="chip text-xs">Por día de la semana</span>
          </div>
          {dayChartData.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dayChartData} barSize={28}>
                <XAxis dataKey="dia" tick={{ fill:'var(--text3)', fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:'var(--text3)', fontSize:9 }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} cursor={{ fill:'rgba(255,77,109,0.08)' }} />
                <Bar dataKey="ausencias" name="Ausencias" radius={[4,4,0,0]} opacity={0.9}>
                  {dayChartData.map((d,i)=>(
                    <Cell key={i} fill={d.ausencias>=3?'var(--red)':d.ausencias>=2?'var(--amber)':'var(--green)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm" style={{ color:'var(--text3)' }}>Sin datos</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Pie chart */}
        <div className="card">
          <h3 className="font-display font-bold text-sm mb-5">Distribución</h3>
          {pieData.length ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={68}
                    paddingAngle={3} dataKey="value">
                    {pieData.map((d,i)=><Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, fontSize:12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {pieData.map((d,i)=>(
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background:d.fill }} />
                      <span style={{ color:'var(--text2)' }}>{d.name}</span>
                    </div>
                    <span className="font-display font-bold" style={{ color:d.fill }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm" style={{ color:'var(--text3)' }}>Sin datos</div>
          )}
        </div>

        {/* Ranking */}
        <div className="card col-span-2">
          <h3 className="font-display font-bold text-sm mb-5">Ranking de asistencia</h3>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {sorted.map((u, i) => {
              const pct   = parseFloat(u.attendance_pct||0);
              const color = pct < threshold ? 'red' : pct < threshold+10 ? 'amber' : 'green';
              return (
                <div key={u.user_id} className="flex items-center gap-3"
                  style={{ borderLeft:`3px solid var(--${color})`, paddingLeft:10 }}>
                  <span className="font-display font-black text-sm w-5 flex-shrink-0" style={{ color:'var(--text3)' }}>
                    {i+1}
                  </span>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background:'linear-gradient(135deg,var(--accent),var(--purple))', color:'white' }}>
                    {u.first_name?.[0]}{u.last_name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate flex items-center gap-1" style={{ color:'var(--text)' }}>
                      {u.first_name} {u.last_name}
                      {u.role === 'admin' && (
                        <span className="badge badge-purple" style={{fontSize:9}}>Admin</span>
                      )}
                    </div>
                    <div className="text-xs" style={{ color:'var(--text3)' }}>
                      {u.total_absent||0} ausencias{u.group_name?` · ${u.group_name}`:''}
                    </div>
                  </div>
                  <div style={{ width:150, flexShrink:0 }}>
                    <ProgressBar value={pct} />
                  </div>
                </div>
              );
            })}
            {!sorted.length && (
              <div className="py-8 text-center text-sm" style={{ color:'var(--text3)' }}>Sin usuarios</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
