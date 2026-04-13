import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../context/authStore';
import { attendanceAPI } from '../services/api';
import { PageHeader, Badge, ProgressBar, Spinner, Empty } from '../components/ui';

const FILTERS = [
  { key:'all',       label:'Todo' },
  { key:'present',   label:'Presente' },
  { key:'absent',    label:'Ausente' },
  { key:'late',      label:'Tardanza' },
  { key:'justified', label:'Justificado' },
];

// 🔥 función segura para fecha
const safeDate = (d) => {
  if (!d) return null;
  const date = new Date(d);
  return isNaN(date) ? null : date;
};

export default function MyAttendance() {
  const { user, refreshUser } = useAuthStore();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (user && !user.organizationId) refreshUser();
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['my-attendance', user?.id],
    queryFn: () => attendanceAPI.getUserHistory(user.id).then(r => r.data),
    enabled: !!user?.id,
  });

  const summary = data?.summary;
  const pct = parseFloat(summary?.attendance_pct || 0);
  const history = (data?.history || []).filter(
    h => filter === 'all' || h.status === filter
  );
  const atRisk = user?.threshold ? pct < user.threshold : pct < 75;

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Mi Asistencia"
        subtitle={`${user?.firstName} ${user?.lastName} · ${user?.organizationName || 'Organización'}`}
      >
        <button className="btn-ghost text-sm" onClick={() => navigate('/my-justifications')}>
          📋 Mis justificaciones
        </button>
        <button className="btn-ghost text-sm" onClick={() => navigate('/calendar')}>
          ◷ Ver calendario
        </button>
      </PageHeader>

      {/* Hero */}
      <div className="card mb-7 relative overflow-hidden">
        <div className="relative flex flex-wrap items-center gap-8">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full flex items-center justify-center font-display font-black text-xl"
              style={{ background:'linear-gradient(135deg,var(--accent),var(--purple))', color:'white' }}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div>
              <div className="font-display font-black" style={{
                fontSize:52,
                color: pct >= 85 ? 'var(--green)' : pct >= 75 ? 'var(--amber)' : 'var(--red)',
              }}>
                {pct.toFixed(1)}%
              </div>
              <div className="text-xs mt-1" style={{ color:'var(--text3)' }}>
                asistencia acumulada
              </div>
              {atRisk && (
                <div className="mt-1 text-xs font-medium" style={{ color:'var(--red)' }}>
                  🚨 Por debajo del umbral mínimo
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-5">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
        <span className="text-xs" style={{ color:'var(--text3)' }}>
          {history.length} registros
        </span>
      </div>

      {/* Tabla */}
      <div className="card">
        {history.length ? (
          <table className="table-auto">
            <thead>
              <tr>
                <th>Sesión</th>
                <th>Fecha</th>
                <th>Grupo</th>
                <th>Estado</th>
                <th>Justificación</th>
                <th>Acción</th>
              </tr>
            </thead>

            <tbody>
              {history.map((h, i) => {
                const date = safeDate(h.session_date);

                return (
                  <tr key={i}>
                    <td>
                      <div>{h.title}</div>
                    </td>

                    <td>
                      <div>
                        {date
                          ? date.toLocaleDateString('es-CO',{
                              day:'numeric',
                              month:'short',
                              year:'numeric'
                            })
                          : '—'}
                      </div>
                      <div style={{ fontSize:12, color:'var(--text3)' }}>
                        {date
                          ? date.toLocaleDateString('es-CO',{ weekday:'long' })
                          : ''}
                      </div>
                    </td>

                    <td>
                      {h.group_name && <span>{h.group_name}</span>}
                    </td>

                    <td>
                      <Badge status={h.status} />
                    </td>

                    <td>
                      {h.justification_status
                        ? <Badge status={h.justification_status} />
                        : '—'}
                    </td>

                    <td>
                      {(h.status==='absent' || h.status==='late') && !h.justification_id && (
                        <button onClick={() => navigate('/my-justifications')}>
                          Justificar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty title="Sin registros" />
        )}
      </div>
    </div>
  );
}