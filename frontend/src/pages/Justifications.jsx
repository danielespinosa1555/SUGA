import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import useAuthStore from '../context/authStore';
import { justificationsAPI } from '../services/api';
import { PageHeader, Badge, Avatar, Modal, Alert, Empty, Spinner, ChatModal } from '../components/ui';

const FILTERS = [
  { key:'all',      label:'Todas' },
  { key:'pending',  label:'Pendiente' },
  { key:'review',   label:'En revisión' },
  { key:'approved', label:'Aprobadas' },
  { key:'rejected', label:'Rechazadas' },
];

const fmtDate = (d) => d
  ? new Date(d+'T12:00').toLocaleDateString('es-CO',{ day:'numeric', month:'short', year:'numeric' })
  : '—';

// ── File Viewer ───────────────────────────────────────────────────────────────
function FileViewer({ justification, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [fileType, setFileType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let obj = null;
    justificationsAPI.getFileBlobUrl(justification.id)
      .then(({ url, type }) => { obj=url; setBlobUrl(url); setFileType(type); setLoading(false); })
      .catch(() => { setError('No se pudo cargar el archivo.'); setLoading(false); });
    return () => { if (obj) URL.revokeObjectURL(obj); };
  }, [justification.id]);
  const isImage = fileType.startsWith('image/');
  const isPDF   = fileType === 'application/pdf';
  return (
    <Modal open={true} onClose={onClose} title={`Documento — ${justification.user_name}`} wide
      footer={<>{blobUrl && <a href={blobUrl} download={justification.file_name} className="btn-ghost text-sm">⬇ Descargar</a>}<button className="btn-ghost" onClick={onClose}>Cerrar</button></>}>
      <div>
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg" style={{ background:'var(--bg3)' }}>
          <Avatar name={justification.user_name} size="sm" />
          <div className="flex-1">
            <div className="text-sm font-medium" style={{ color:'var(--text)' }}>{justification.user_name}</div>
            <div className="text-xs" style={{ color:'var(--text3)' }}>{justification.session_title} · {fmtDate(justification.session_date)}</div>
          </div>
          <Badge status={justification.status} />
        </div>
        <div className="mb-4 text-sm p-3 rounded-lg" style={{ background:'var(--bg4)', color:'var(--text2)' }}>
          <span className="text-xs font-medium block mb-1" style={{ color:'var(--text3)' }}>Motivo</span>
          {justification.reason}
        </div>
        <div className="rounded-xl overflow-hidden" style={{ border:'1px solid var(--border)', minHeight:300, background:'var(--bg3)' }}>
          {loading && <div className="flex items-center justify-center h-64"><div className="text-2xl mb-2">⏳</div></div>}
          {error  && <div className="flex items-center justify-center h-64 text-sm" style={{ color:'var(--red)' }}>{error}</div>}
          {!loading && !error && blobUrl && isPDF   && <iframe src={blobUrl} style={{ width:'100%', height:480, border:'none' }} />}
          {!loading && !error && blobUrl && isImage && <div className="flex items-center justify-center p-4"><img src={blobUrl} alt="" style={{ maxWidth:'100%', maxHeight:480, borderRadius:8, objectFit:'contain' }} /></div>}
          {!loading && !error && blobUrl && !isPDF && !isImage && (
            <div className="flex items-center justify-center h-48 flex-col gap-3">
              <div className="text-4xl">📄</div>
              <a href={blobUrl} download={justification.file_name} className="btn-primary text-sm">⬇ Descargar</a>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Justifications() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [filter, setFilter]         = useState('all');
  const [rejectTarget, setRejectTarget] = useState(null);
  const [viewFile, setViewFile]     = useState(null);
  const [chatTarget, setChatTarget] = useState(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['justifications-admin', filter],
    queryFn: () => justificationsAPI.getAll(filter !== 'all' ? { status:filter } : {}).then(r => r.data),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, comment }) => justificationsAPI.review(id, { status, comment }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries(['justifications-admin']);
      if (vars.status === 'approved') toast.success('✓ Justificación aprobada');
      else if (vars.status === 'rejected') toast.success('Justificación rechazada');
      else toast.success('Estado actualizado');
      setRejectTarget(null); reset();
    },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  const approve   = id => reviewMutation.mutate({ id, status:'approved' });
  const setReview = id => reviewMutation.mutate({ id, status:'review' });
  const openReject = j => { setRejectTarget(j); reset(); };
  const submitReject = fd => reviewMutation.mutate({ id:rejectTarget.id, status:'rejected', comment:fd.comment });

  const items        = data?.justifications || [];
  const pendingCount = items.filter(j => j.status === 'pending' || j.status === 'review').length;

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Justificaciones" subtitle="Revisa, comunícate y decide sobre las solicitudes">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background:'var(--bg3)' }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className="text-xs px-3 py-1.5 rounded-lg transition-all"
              style={{ background:filter===f.key?'var(--bg2)':'transparent', color:filter===f.key?'var(--text)':'var(--text3)', border:filter===f.key?'1px solid var(--border)':'1px solid transparent', fontWeight:filter===f.key?500:400 }}>
              {f.label}
              {f.key==='pending' && pendingCount>0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-white font-bold"
                  style={{ background:'var(--red)', fontSize:9 }}>{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      </PageHeader>

      {pendingCount > 0 && filter === 'all' && (
        <div className="mb-5">
          <Alert type="warning"><span>⚠</span><span>{pendingCount} justificación(es) esperan tu revisión</span></Alert>
        </div>
      )}

      <div className="card">
        {items.length ? (
          <table className="table-auto">
            <thead>
              <tr><th>Miembro</th><th>Sesión</th><th>Motivo</th><th>Soporte</th><th>Enviada</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {items.map(j => (
                <tr key={j.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar name={j.user_name} size="sm" />
                      <div>
                        <div className="font-medium text-sm" style={{ color:'var(--text)' }}>{j.user_name}</div>
                        {j.group_name && <div className="text-xs" style={{ color:'var(--text3)' }}>{j.group_name}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="text-sm font-medium" style={{ color:'var(--text)' }}>{j.session_title}</div>
                    <div className="text-xs" style={{ color:'var(--text3)' }}>{fmtDate(j.session_date)}</div>
                  </td>
                  <td><div className="text-xs max-w-40" style={{ color:'var(--text2)', wordBreak:'break-word' }}>{j.reason}</div></td>
                  <td>
                    {j.file_name
                      ? <button onClick={() => setViewFile(j)} className="chip text-xs flex items-center gap-1" style={{ cursor:'pointer' }}>
                          <span>{j.file_type==='application/pdf'?'📄':'🖼'}</span>
                          <span className="max-w-28 truncate">{j.file_name}</span>
                          <span style={{ color:'var(--accent2)', fontSize:9 }}>VER</span>
                        </button>
                      : <span className="text-xs" style={{ color:'var(--text3)' }}>—</span>}
                  </td>
                  <td className="text-xs" style={{ color:'var(--text3)' }}>
                    {new Date(j.submitted_at).toLocaleDateString('es-CO',{ day:'numeric', month:'short' })}
                  </td>
                  <td>
                    <Badge status={j.status} />
                    {j.reviewer_name && <div className="text-xs mt-0.5" style={{ color:'var(--text3)' }}>por {j.reviewer_name}</div>}
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Chat button */}
                      <button
                        onClick={() => setChatTarget(j)}
                        style={{
                          display:'inline-flex', alignItems:'center', gap:4,
                          padding:'5px 10px', borderRadius:6, border:'1px solid var(--wire2)',
                          background:'var(--ink3)', color:'var(--text2)', fontSize:11, cursor:'pointer',
                          fontFamily:'"Instrument Sans"',
                        }}
                        title="Abrir chat privado">
                        💬{parseInt(j.message_count)>0 && <span style={{ color:'var(--accent2)', fontWeight:700 }}>{j.message_count}</span>}
                      </button>

                      {(j.status === 'pending' || j.status === 'review') && (
                        <>
                          <button className="text-xs px-2.5 py-1.5 rounded-md font-medium"
                            style={{ background:'var(--green-bg)', color:'var(--green)', border:'1px solid var(--green)' }}
                            onClick={() => approve(j.id)} disabled={reviewMutation.isPending}>✓</button>
                          <button className="text-xs px-2.5 py-1.5 rounded-md font-medium"
                            style={{ background:'var(--red-bg)', color:'var(--red)', border:'1px solid var(--red)' }}
                            onClick={() => openReject(j)}>✕</button>
                          {j.status === 'pending' && (
                            <button className="btn-ghost text-xs py-1 px-2" onClick={() => setReview(j.id)}>🔍</button>
                          )}
                        </>
                      )}
                      {j.status === 'approved' && <span className="text-xs" style={{ color:'var(--green)' }}>✓ Aprobada</span>}
                      {j.status === 'rejected' && j.review_comment && (
                        <div>
                          <span className="text-xs" style={{ color:'var(--red)' }}>✕ Rechazada</span>
                          <div className="text-xs italic mt-0.5 max-w-36" title={j.review_comment} style={{ color:'var(--text3)' }}>
                            "{j.review_comment.length>45 ? j.review_comment.slice(0,42)+'...' : j.review_comment}"
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty icon="⬡" title="Sin justificaciones"
            subtitle={filter!=='all' ? `No hay justificaciones con estado "${FILTERS.find(f=>f.key===filter)?.label}"` : 'No se han enviado justificaciones aún'} />
        )}
      </div>

      {/* File viewer */}
      {viewFile && <FileViewer justification={viewFile} onClose={() => setViewFile(null)} />}

      {/* Chat — uses new standalone ChatModal */}
      {chatTarget && (
        <ChatModal
          open={true}
          onClose={() => setChatTarget(null)}
          justificationId={chatTarget.id}
          memberName={chatTarget.user_name}
          sessionTitle={chatTarget.session_title}
          status={chatTarget.status}
          reason={chatTarget.reason}
          currentUserId={user?.id}
        />
      )}

      {/* Reject modal */}
      <Modal open={!!rejectTarget} onClose={() => { setRejectTarget(null); reset(); }} title="Rechazar justificación"
        footer={
          <><button className="btn-ghost" onClick={() => { setRejectTarget(null); reset(); }}>Cancelar</button>
          <button className="btn-danger" onClick={handleSubmit(submitReject)} disabled={reviewMutation.isPending}>
            {reviewMutation.isPending ? 'Rechazando...' : 'Confirmar rechazo'}
          </button></>
        }>
        {rejectTarget && (
          <div className="space-y-4">
            <div className="rounded-lg p-3" style={{ background:'var(--bg3)' }}>
              <div className="flex items-center gap-3 mb-2">
                <Avatar name={rejectTarget.user_name} size="sm" />
                <div>
                  <div className="text-sm font-medium" style={{ color:'var(--text)' }}>{rejectTarget.user_name}</div>
                  <div className="text-xs" style={{ color:'var(--text3)' }}>{rejectTarget.session_title}</div>
                </div>
              </div>
              <div className="text-xs p-2 rounded" style={{ background:'var(--bg4)', color:'var(--text2)' }}>{rejectTarget.reason}</div>
            </div>
            <div>
              <label className="label">Motivo del rechazo *</label>
              <textarea className="input resize-none" rows={3}
                placeholder="Explica al miembro por qué se rechaza..."
                {...register('comment',{ required:'Requerido', minLength:{ value:10, message:'Mínimo 10 caracteres' } })} />
              {errors.comment && <p className="text-xs mt-1" style={{ color:'var(--red)' }}>{errors.comment.message}</p>}
            </div>
            <Alert type="warning"><span>⚠</span><span className="text-xs">El miembro recibirá una notificación y correo con este comentario.</span></Alert>
          </div>
        )}
      </Modal>
    </div>
  );
}
