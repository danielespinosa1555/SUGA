import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { sessionsAPI, attendanceAPI } from '../services/api';
import { PageHeader, Badge, Avatar, Spinner, Empty, Alert } from '../components/ui';

const STATUS_OPTIONS = [
  { key:'present',   label:'Presente',   color:'var(--green)',  bg:'var(--green-bg)' },
  { key:'absent',    label:'Ausente',    color:'var(--red)',    bg:'var(--red-bg)' },
  { key:'late',      label:'Tardanza',   color:'var(--amber)',  bg:'var(--amber-bg)' },
  { key:'justified', label:'Justificado',color:'var(--purple)', bg:'var(--purple-bg)' },
];

export default function AttendancePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [records, setRecords] = useState({});   // { userId: status }
  const [dirty,   setDirty]   = useState(false);
  const [search,  setSearch]  = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['session-detail', id],
    queryFn: () => sessionsAPI.getOne(id).then(r => r.data),
  });

  // Initialize local state from server data
  useEffect(() => {
    if (data?.attendance) {
      const init = {};
      data.attendance.forEach(a => { init[a.id] = a.status || 'absent'; });
      setRecords(init);
      setDirty(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: payload => attendanceAPI.saveBulk(payload),
    onSuccess: () => { toast.success('Asistencia guardada correctamente ✓'); setDirty(false); },
    onError:   e => toast.error(e.response?.data?.error || 'Error al guardar'),
  });

  const setStatus = (userId, status) => {
    setRecords(prev => ({ ...prev, [userId]: status }));
    setDirty(true);
  };

  const markAll = status => {
    const updated = {};
    (data?.attendance || []).forEach(a => { updated[a.id] = status; });
    setRecords(updated);
    setDirty(true);
  };

  const save = () => {
    const payload = (data?.attendance || []).map(a => ({
      userId: a.id,
      status: records[a.id] || 'absent',
    }));
    saveMutation.mutate({ sessionId: id, records: payload });
  };

  if (isLoading) return <Spinner />;
  const { session, attendance = [] } = data || {};

  // Stats
  const present   = Object.values(records).filter(v => v === 'present').length;
  const absent    = Object.values(records).filter(v => v === 'absent').length;
  const late      = Object.values(records).filter(v => v === 'late').length;
  const justified = Object.values(records).filter(v => v === 'justified').length;
  const total     = attendance.length;
  const pct       = total ? Math.round((present + justified + late) / total * 100) : 0;

  // Filtered list
  const filtered = attendance.filter(a => {
    if (!search) return true;
    return `${a.first_name} ${a.last_name} ${a.email}`.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div>
      <PageHeader
        title={session?.title || 'Asistencia'}
        subtitle={
          session
            ? `${new Date(session.session_date+'T12:00').toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long', year:'numeric' })} · ${session.group_name}`
            : ''
        }
      >
        <button className="btn-ghost text-sm" onClick={() => navigate('/sessions')}>← Sesiones</button>
        <button className="btn-primary text-sm" onClick={save} disabled={saveMutation.isPending || !dirty}>
          {saveMutation.isPending ? 'Guardando...' : dirty ? '✓ Guardar cambios' : '✓ Guardado'}
        </button>
      </PageHeader>

      {dirty && (
        <div className="mb-5">
          <Alert type="warning">
            <span>⚠</span>
            <span>Tienes cambios sin guardar</span>
          </Alert>
        </div>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-5 gap-4 mb-7">
        {[
          { label:'Presentes',    value: present,   color:'green' },
          { label:'Ausentes',     value: absent,    color:'red' },
          { label:'Tardanzas',    value: late,       color:'amber' },
          { label:'Justificados', value: justified,  color:'purple' },
          { label:'% Asistencia', value: `${pct}%`,  color: pct>=85?'green':pct>=75?'amber':'red' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ borderTop:`2px solid var(--${s.color})` }}>
            <div className="text-xs tracking-widest uppercase mb-1" style={{ color:'var(--text3)' }}>{s.label}</div>
            <div className="font-display font-black text-3xl" style={{ color:`var(--${s.color})` }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-5 gap-3">
          <input className="input text-sm" style={{ width:220 }}
            placeholder="Buscar miembro..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <div className="flex gap-2">
            {STATUS_OPTIONS.map(opt => (
              <button key={opt.key}
                className="text-xs px-3 py-1.5 rounded-md font-medium transition-all"
                style={{ background: opt.bg, color: opt.color, border:`1px solid ${opt.color}` }}
                onClick={() => markAll(opt.key)}>
                Todos {opt.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length ? (
          <div>
            {filtered.map(member => {
              const status = records[member.id] || 'absent';
              return (
                <div key={member.id}
                  className="flex items-center gap-4 py-3 px-2 rounded-lg transition-colors"
                  style={{ borderBottom:'1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--bg3)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                >
                  <Avatar name={`${member.first_name} ${member.last_name}`} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate" style={{ color:'var(--text)' }}>
                      {member.first_name} {member.last_name}
                      {member.role === 'admin' && (
                        <span className="ml-2 badge badge-purple" style={{ fontSize:9 }}>Admin</span>
                      )}
                    </div>
                    <div className="text-xs truncate" style={{ color:'var(--text3)' }}>
                      {member.group_name && `${member.group_name} · `}{member.email}
                    </div>
                  </div>

                  {member.justification_id && (
                    <span className="chip text-xs">📎 Justificación</span>
                  )}

                  {/* Status toggle buttons */}
                  <div className="flex items-center gap-1">
                    {STATUS_OPTIONS.map(opt => (
                      <button key={opt.key}
                        onClick={() => setStatus(member.id, opt.key)}
                        title={opt.label}
                        className="text-xs px-2.5 py-1.5 rounded-md font-medium transition-all duration-100"
                        style={{
                          background: status === opt.key ? opt.bg : 'var(--bg4)',
                          color:      status === opt.key ? opt.color : 'var(--text3)',
                          border:     `1px solid ${status === opt.key ? opt.color : 'var(--border)'}`,
                          transform:  status === opt.key ? 'scale(1.05)' : 'scale(1)',
                          fontWeight: status === opt.key ? 600 : 400,
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty icon="◉"
            title={search ? 'Sin resultados' : 'Sin miembros'}
            subtitle={search ? `No se encontró "${search}"` : 'No hay miembros en esta sesión'} />
        )}
      </div>
    </div>
  );
}
