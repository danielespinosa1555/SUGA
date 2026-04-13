import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import useAuthStore from '../context/authStore';
import { attendanceAPI, justificationsAPI } from '../services/api';
import { PageHeader, Badge, Alert, Spinner } from '../components/ui';

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

const STATUS_CFG = {
  present:   { bg:'var(--green-bg)',  text:'var(--green)',  label:'Presente' },
  absent:    { bg:'var(--red-bg)',    text:'var(--red)',    label:'Ausente' },
  late:      { bg:'var(--blue-bg)',   text:'var(--blue)',   label:'Tardanza' },
  justified: { bg:'var(--purple-bg)', text:'var(--purple)', label:'Justificado' },
  pending:   { bg:'var(--amber-bg)',  text:'var(--amber)',  label:'Pendiente' },
};

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstWeekday(year, month) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const fileRef = useRef();
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['calendar', user?.id, year, month + 1],
    queryFn: () => attendanceAPI.getCalendar(user.id, { year, month: month + 1 }).then(r => r.data),
    enabled: !!user?.id,
  });

  const submitMutation = useMutation({
    mutationFn: fd => justificationsAPI.create(fd),
    onSuccess: () => {
      toast.success('Justificación enviada correctamente');
      qc.invalidateQueries(['calendar']);
      qc.invalidateQueries(['my-absences']);
      qc.invalidateQueries(['my-justifications']);
      setShowForm(false);
      setSelected(null);
      reset();
    },
    onError: e => toast.error(e.response?.data?.error || 'Error al enviar'),
  });

  const onSubmit = formData => {
    if (!selected?.attendance_id) {
      toast.error('No hay registro de asistencia para este día');
      return;
    }
    const fd = new FormData();
    fd.append('attendanceId', selected.attendance_id);
    fd.append('sessionId',    selected.session_id);
    fd.append('reason',       formData.reason);
    if (fileRef.current?.files?.[0]) fd.append('file', fileRef.current.files[0]);
    submitMutation.mutate(fd);
  };

  // Build calendar map keyed by ISO date string
  const calMap = {};
  (data?.calendar || []).forEach(d => {
    const key = typeof d.session_date === 'string'
      ? d.session_date.slice(0, 10)
      : new Date(d.session_date).toISOString().slice(0, 10);
    // effective status
    const effStatus = d.justification_status === 'approved' ? 'justified'
                    : d.justification_status === 'pending'  ? 'pending'
                    : d.status;
    calMap[key] = { ...d, effectiveStatus: effStatus };
  });

  const daysInMonth  = getDaysInMonth(year, month);
  const firstWeekday = getFirstWeekday(year, month);
  const todayKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y=>y-1); } else setMonth(m=>m-1); };
  const nextMonth = () => { if (month===11) { setMonth(0);  setYear(y=>y+1); } else setMonth(m=>m+1); };

  // Summary counts
  const counts = { present:0, absent:0, late:0, justified:0, pending:0 };
  Object.values(calMap).forEach(d => { if (counts[d.effectiveStatus] !== undefined) counts[d.effectiveStatus]++; });
  const totalSessions = Object.keys(calMap).length;
  const attended = counts.present + counts.justified + counts.late;
  const pct = totalSessions ? Math.round(attended / totalSessions * 100) : null;

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Calendario" subtitle={`${MONTHS[month]} ${year}`}>
        <button className="btn-ghost text-sm" onClick={prevMonth}>◀</button>
        <button className="btn-ghost text-sm" onClick={() => { setMonth(now.getMonth()); setYear(now.getFullYear()); }}>
          Hoy
        </button>
        <button className="btn-ghost text-sm" onClick={nextMonth}>▶</button>
      </PageHeader>

      <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 320px' }}>

        {/* ── Calendar grid ── */}
        <div className="card">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-medium tracking-wider py-2" style={{ color:'var(--text3)' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstWeekday }).map((_,i) => <div key={`e${i}`} />)}

            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const key = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const entry   = calMap[key];
              const cfg     = entry ? STATUS_CFG[entry.effectiveStatus] : null;
              const isToday = key === todayKey;
              const isSel   = selected?.date === key;

              return (
                <div
                  key={key}
                  onClick={() => { setSelected(entry ? { ...entry, date: key } : null); setShowForm(false); reset(); }}
                  className="rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all duration-150 relative select-none"
                  style={{
                    aspectRatio: '1',
                    background: isSel ? 'var(--accent3)' : cfg ? cfg.bg : 'transparent',
                    color:      isSel ? 'var(--accent2)' : cfg ? cfg.text : 'var(--text2)',
                    outline:    isToday ? '2px solid var(--accent)' : 'none',
                    outlineOffset: 2,
                    fontWeight: isToday ? 700 : 400,
                  }}
                  onMouseEnter={e => { if (!cfg && !isSel) e.currentTarget.style.background = 'var(--bg3)'; }}
                  onMouseLeave={e => { if (!cfg && !isSel) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span className="text-sm">{day}</span>
                  {cfg && (
                    <div className="w-1 h-1 rounded-full mt-0.5" style={{ background: cfg.text }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-5 pt-4" style={{ borderTop:'1px solid var(--border)' }}>
            {Object.entries(STATUS_CFG).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5 text-xs" style={{ color:'var(--text2)' }}>
                <div className="w-3 h-3 rounded-sm" style={{ background: v.bg, border:`1px solid ${v.text}` }} />
                {v.label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Side panel ── */}
        <div className="space-y-4">

          {/* Monthly summary */}
          <div className="card">
            <h3 className="font-display font-bold text-sm mb-4">{MONTHS[month]} {year}</h3>
            {pct !== null && (
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm" style={{ color:'var(--text2)' }}>Asistencia del mes</span>
                <span className="font-display font-black text-2xl" style={{ color: pct>=75?'var(--green)':'var(--red)' }}>
                  {pct}%
                </span>
              </div>
            )}
            <div className="space-y-2">
              {Object.entries(STATUS_CFG).map(([k,v]) => counts[k] > 0 && (
                <div key={k} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: v.text }} />
                    <span className="text-sm" style={{ color:'var(--text2)' }}>{v.label}</span>
                  </div>
                  <span className="font-display font-bold text-sm" style={{ color: v.text }}>{counts[k]}</span>
                </div>
              ))}
              {totalSessions === 0 && (
                <p className="text-sm text-center py-4" style={{ color:'var(--text3)' }}>Sin sesiones este mes</p>
              )}
            </div>
          </div>

          {/* Day detail */}
          {selected ? (
            <div className="card space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display font-bold text-sm">{selected.title}</div>
                  <div className="text-xs mt-1" style={{ color:'var(--text3)' }}>
                    {new Date(selected.date+'T12:00').toLocaleDateString('es-CO',
                      { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
                  </div>
                  {selected.group_name && (
                    <span className="chip text-xs mt-1">{selected.group_name}</span>
                  )}
                </div>
                <Badge status={selected.effectiveStatus} />
              </div>

              {/* Justification status info */}
              {selected.justification_status === 'approved' && (
                <Alert type="success">
                  <span>✓</span>
                  <span className="text-xs">Justificación aprobada · no afecta tu promedio</span>
                </Alert>
              )}
              {selected.justification_status === 'pending' && (
                <Alert type="warning">
                  <span>⏳</span>
                  <span className="text-xs">Justificación enviada · esperando revisión</span>
                </Alert>
              )}
              {selected.justification_status === 'review' && (
                <Alert type="info">
                  <span>🔍</span>
                  <span className="text-xs">Tu justificación está siendo revisada</span>
                </Alert>
              )}
              {selected.reason && (
                <div className="rounded-lg p-2.5 text-xs" style={{ background:'var(--bg3)', color:'var(--text2)' }}>
                  📋 {selected.reason}
                </div>
              )}

              {/* Show justify button only if absent/late and no active justification */}
              {(selected.status === 'absent' || selected.status === 'late') &&
               !selected.justification_id && (
                !showForm ? (
                  <button className="w-full btn-primary justify-center py-2.5 text-sm" onClick={() => setShowForm(true)}>
                    + Enviar justificación
                  </button>
                ) : (
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                    <div>
                      <label className="label">Motivo *</label>
                      <textarea className="input resize-none text-sm" rows={3}
                        placeholder="Describe el motivo de tu ausencia..."
                        {...register('reason', { required:'Requerido', minLength:{ value:10, message:'Mínimo 10 caracteres' } })} />
                      {errors.reason && <p className="text-xs mt-1" style={{ color:'var(--red)' }}>{errors.reason.message}</p>}
                    </div>
                    <div>
                      <label className="label">Soporte (opcional)</label>
                      <div className="border-2 border-dashed rounded-xl p-3 text-center cursor-pointer"
                        style={{ borderColor:'var(--border2)' }}
                        onClick={() => fileRef.current?.click()}
                        onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor='var(--border2)'}
                      >
                        <div className="text-xs" style={{ color:'var(--text3)' }}>
                          📎 PDF, JPG, PNG · máx 5MB
                        </div>
                        <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                          onChange={e => e.target.files?.[0] && toast(`📎 ${e.target.files[0].name}`, { icon:'📎' })} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" className="btn-ghost flex-1 text-xs justify-center py-2"
                        onClick={() => { setShowForm(false); reset(); }}>Cancelar</button>
                      <button type="submit" className="btn-primary flex-1 text-xs justify-center py-2"
                        disabled={submitMutation.isPending}>
                        {submitMutation.isPending ? 'Enviando...' : 'Enviar →'}
                      </button>
                    </div>
                  </form>
                )
              )}
            </div>
          ) : (
            <div className="card text-center py-8" style={{ color:'var(--text3)' }}>
              <div className="text-3xl mb-2 opacity-30">◷</div>
              <p className="text-sm">Selecciona un día con sesión</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
