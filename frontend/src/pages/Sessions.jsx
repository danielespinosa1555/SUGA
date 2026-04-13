import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { sessionsAPI } from '../services/api';
import { PageHeader, Badge, ProgressBar, Modal, Empty, Spinner } from '../components/ui';

const fmtDate = (d) => {
  if (!d) return '—';
  const date = new Date(d + 'T12:00');
  return date.toLocaleDateString('es-CO', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
};

// ── Circular Modal ─────────────────────────────────────────────────────────────
function CircularModal({ session, onClose }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (message.trim().length < 5) { toast.error('Escribe al menos 5 caracteres'); return; }
    setSending(true);
    try {
      const r = await sessionsAPI.circular(session.id, { message: message.trim() });
      if (r.data.smtpConfigured === false) {
        toast('Notificaciones creadas, pero SMTP no está configurado — los correos no se enviaron. Ve a Configuración → Email/SMTP', 
          { icon:'⚠️', duration:8000 });
      } else {
        toast.success(`✉ Circular enviada a ${r.data.sent} miembro(s)`);
      }
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al enviar circular');
    } finally { setSending(false); }
  };

  return (
    <Modal open={true} onClose={onClose} title={`Enviar circular — ${session.title}`}
      footer={
        <><button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" onClick={send} disabled={sending || message.trim().length < 5}>
          {sending ? 'Enviando...' : `✉ Enviar a miembros`}
        </button></>
      }>
      <div className="space-y-4">
        <div className="p-3 rounded-lg text-xs" style={{ background:'var(--bg3)', color:'var(--text2)', border:'1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <span style={{ color:'var(--text3)' }}>📅</span>
            <strong>{fmtDate(session.session_date)}</strong>
          </div>
          <span style={{ color:'var(--text3)' }}>
            Se enviará un correo profesional a todos los miembros registrados en esta sesión.
          </span>
        </div>

        <div>
          <label className="label">Mensaje para los asistentes *</label>
          <textarea
            className="input resize-none"
            rows={5}
            placeholder={`Ej: Recuerden traer sus avances del proyecto para la próxima reunión. El lugar de encuentro será la Sala de Juntas B, piso 3.\n\nSaludos,\nEquipo de coordinación`}
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
          <div className="text-xs mt-1 text-right" style={{ color:'var(--text3)' }}>{message.length} caracteres</div>
        </div>

        <div className="p-3 rounded-lg text-xs space-y-1.5" style={{ background:'var(--bg4)', border:'1px solid var(--border)' }}>
          <div className="font-medium mb-2" style={{ color:'var(--text2)' }}>El correo incluirá:</div>
          {[
            '✉ Cabecera con el nombre de la organización y la sesión',
            '📝 Tu mensaje tal como lo escribiste',
            '📅 Fecha y nombre de la sesión',
            '🔗 Enlace directo a SUGA para ver asistencia o justificaciones',
          ].map((item, i) => (
            <div key={i} style={{ color:'var(--text3)' }}>{item}</div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Sessions() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editSession, setEditSession] = useState(null);
  const [circularTarget, setCircularTarget] = useState(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessionsAPI.getAll().then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (d) => editSession ? sessionsAPI.update(editSession.id, d) : sessionsAPI.create(d),
    onSuccess: () => {
      qc.invalidateQueries(['sessions']);
      toast.success(editSession ? 'Sesión actualizada' : 'Sesión creada');
      setShowModal(false); reset(); setEditSession(null);
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => sessionsAPI.delete(id),
    onSuccess: () => { qc.invalidateQueries(['sessions']); toast.success('Sesión eliminada'); },
  });

  const openCreate = () => { setEditSession(null); reset({}); setShowModal(true); };
  const openEdit = (s) => {
    setEditSession(s);
    reset({ title:s.title, description:s.description, sessionDate:s.session_date?.slice(0,10), groupName:s.group_name, startTime:s.start_time?.slice(0,5), endTime:s.end_time?.slice(0,5), location:s.location||'' });
    setShowModal(true);
  };

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Sesiones" subtitle={`${data?.total || 0} sesiones registradas`}>
        <button className="btn-primary text-sm" onClick={openCreate}>+ Crear sesión</button>
      </PageHeader>

      <div className="card">
        {data?.sessions?.length ? (
          <table className="table-auto">
            <thead>
              <tr><th>#</th><th>Sesión</th><th>Grupo</th><th>Fecha</th><th>Presentes</th><th>Asistencia</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {data.sessions.map((s, i) => (
                <tr key={s.id}>
                  <td className="text-xs font-mono" style={{ color:'var(--text3)' }}>#{i+1}</td>
                  <td>
                    <div className="font-medium text-sm" style={{ color:'var(--text)' }}>{s.title}</div>
                    {s.description && <div className="text-xs mt-0.5 truncate max-w-48" style={{ color:'var(--text3)' }}>{s.description}</div>}
                    {s.location && <div className="text-xs mt-0.5" style={{ color:'var(--text3)' }}>📍 {s.location}</div>}
                    {(s.start_time || s.end_time) && (
                      <div className="text-xs mt-0.5" style={{ color:'var(--text3)' }}>
                        ⏰ {s.start_time?.slice(0,5)}{s.end_time ? ` – ${s.end_time.slice(0,5)}` : ''}
                      </div>
                    )}
                  </td>
                  <td><span className="chip text-xs">{s.group_name || '—'}</span></td>
                  <td>
                    <div className="text-sm font-medium" style={{ color:'var(--text)' }}>
                      {s.session_date ? new Date(s.session_date+'T12:00').toLocaleDateString('es-CO',{ day:'numeric', month:'short', year:'numeric' }) : '—'}
                    </div>
                    {s.session_date && (
                      <div className="text-xs" style={{ color:'var(--text3)' }}>
                        {new Date(s.session_date+'T12:00').toLocaleDateString('es-CO',{ weekday:'long' })}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="font-display font-semibold" style={{ color:'var(--text)' }}>
                      {s.present_count}/{s.total_records}
                    </span>
                  </td>
                  <td style={{ minWidth:140 }}><ProgressBar value={parseFloat(s.attendance_pct||0)} /></td>
                  <td>
                    <div className="flex gap-1.5 flex-wrap">
                      <button className="btn-ghost text-xs py-1 px-2" onClick={() => navigate(`/sessions/${s.id}/attendance`)}>
                        Asistencia
                      </button>
                      <button className="btn-ghost text-xs py-1 px-2" onClick={() => setCircularTarget(s)}
                        title="Enviar circular por correo a los asistentes">
                        ✉ Circular
                      </button>
                      <button className="btn-ghost text-xs py-1 px-2" onClick={() => openEdit(s)}>Editar</button>
                      <button className="btn-danger text-xs py-1 px-2"
                        onClick={() => { if(confirm('¿Eliminar esta sesión?')) deleteMutation.mutate(s.id); }}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty icon="◎" title="Sin sesiones" subtitle="Crea la primera sesión para comenzar" />}
      </div>

      {/* Circular Modal */}
      {circularTarget && <CircularModal session={circularTarget} onClose={() => setCircularTarget(null)} />}

      {/* Create/Edit Modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setEditSession(null); reset(); }}
        title={editSession ? 'Editar sesión' : 'Nueva sesión'}
        footer={
          <><button className="btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
          <button className="btn-primary" onClick={handleSubmit((d) => createMutation.mutate({ ...d, sessionDate:d.sessionDate }))}>
            {createMutation.isPending ? 'Guardando...' : editSession ? 'Actualizar' : 'Crear sesión'}
          </button></>
        }>
        <form className="space-y-4">
          <div>
            <label className="label">Título *</label>
            <input className="input" placeholder="Ej: Reunión de equipo Q2" {...register('title',{ required:'Requerido' })} />
            {errors.title && <p className="text-xs mt-1" style={{ color:'var(--red)' }}>{errors.title.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha *</label>
              <input className="input" type="date" {...register('sessionDate',{ required:'Requerido' })} />
              {errors.sessionDate && <p className="text-xs mt-1" style={{ color:'var(--red)' }}>{errors.sessionDate.message}</p>}
            </div>
            <div>
              <label className="label">Grupo</label>
              <input className="input" placeholder="Dev, Diseño, Todos..." {...register('groupName')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Hora inicio</label>
              <input className="input" type="time" {...register('startTime')} />
            </div>
            <div>
              <label className="label">Hora fin</label>
              <input className="input" type="time" {...register('endTime')} />
            </div>
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input resize-none" rows={2} placeholder="Descripción opcional..." {...register('description')} />
          </div>
          <div>
            <label className="label">Ubicación</label>
            <input className="input" placeholder="Sala de juntas, Google Meet, Piso 3..." {...register('location')} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
