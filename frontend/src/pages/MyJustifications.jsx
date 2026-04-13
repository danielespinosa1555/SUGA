import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import useAuthStore from '../context/authStore';
import { justificationsAPI } from '../services/api';
import { PageHeader, Badge, Alert, Modal, Spinner, Empty, ChatModal } from '../components/ui';

const fmtDate = (d) => d ? new Date(d+'T12:00').toLocaleDateString('es-CO',{ weekday:'long', day:'numeric', month:'long', year:'numeric' }) : '—';
const fmtDateShort = (d) => d ? new Date(d+'T12:00').toLocaleDateString('es-CO',{ day:'numeric', month:'short', year:'numeric' }) : '—';

// ── Inline file viewer ────────────────────────────────────────────────────────
function FileContent({ justificationId, fileType }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  useEffect(() => {
    let url = null;
    justificationsAPI.getFileBlobUrl(justificationId)
      .then(({ url:u }) => { url=u; setBlobUrl(u); setLoading(false); })
      .catch(() => { setError('No se pudo cargar el archivo.'); setLoading(false); });
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [justificationId]);
  if (loading) return <div className="flex items-center justify-center h-48 text-sm" style={{ color:'var(--text3)' }}>Cargando...</div>;
  if (error)   return <div className="flex items-center justify-center h-48 text-sm" style={{ color:'var(--red)' }}>{error}</div>;
  if (!blobUrl) return null;
  const isPDF = fileType === 'application/pdf';
  const isImg = fileType?.startsWith('image/');
  if (isPDF) return <iframe src={blobUrl} style={{ width:'100%', height:460, border:'none', display:'block' }} />;
  if (isImg) return <div className="flex items-center justify-center p-4"><img src={blobUrl} alt="Documento" style={{ maxWidth:'100%', maxHeight:460, objectFit:'contain', borderRadius:8 }} /></div>;
  return <div className="flex flex-col items-center justify-center h-40 gap-3"><div className="text-4xl">📄</div><a href={blobUrl} download className="btn-primary text-sm">⬇ Descargar</a></div>;
}

// ChatPanel removed — using ChatModal from ui/index

// ── Main ─────────────────────────────────────────────────────────────────────
export default function MyJustifications() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [selected, setSelected]   = useState(null); // to submit new
  const [viewFile, setViewFile]   = useState(null);
  const [chatOpen, setChatOpen]   = useState(null); // justification id for chat
  const [tab, setTab]             = useState('pending'); // pending | history
  const fileRef = useRef();
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data: absData, isLoading: la } = useQuery({
    queryKey: ['my-absences'],
    queryFn: () => justificationsAPI.getMyAbsences().then(r => r.data),
    enabled: !!user,
  });
  const { data: justData, isLoading: lj } = useQuery({
    queryKey: ['my-justifications'],
    queryFn: () => justificationsAPI.getAll({ mine:'true' }).then(r => r.data),
    enabled: !!user,
  });

  const submitMutation = useMutation({
    mutationFn: (fd) => justificationsAPI.create(fd),
    onSuccess: () => {
      toast.success('Justificación enviada. El administrador la revisará pronto.');
      qc.invalidateQueries(['my-absences']); qc.invalidateQueries(['my-justifications']);
      setSelected(null); reset();
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Error al enviar'),
  });

  const onSubmit = (formData) => {
    if (!selected) return;
    const fd = new FormData();
    fd.append('attendanceId', selected.attendance_id);
    fd.append('sessionId',    selected.session_id);
    fd.append('reason',       formData.reason);
    if (fileRef.current?.files?.[0]) fd.append('file', fileRef.current.files[0]);
    submitMutation.mutate(fd);
  };

  const absences   = absData?.absences || [];
  const pending    = absences.filter(a => !a.justification_id);
  const inProgress = absences.filter(a => a.justification_id && a.justification_status !== 'approved');
  const myJust     = justData?.justifications || [];

  if (la || lj) return <Spinner />;

  return (
    <div>
      <PageHeader title="Mis justificaciones"
        subtitle={`${pending.length} sin justificar · ${inProgress.length} en proceso · ${myJust.length} total`}>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background:'var(--bg3)' }}>
          {[{ k:'pending', l:'Pendientes' }, { k:'history', l:'Historial' }].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className="text-xs px-3 py-1.5 rounded-lg transition-all"
              style={{ background:tab===t.k?'var(--bg2)':'transparent', color:tab===t.k?'var(--text)':'var(--text3)', border:tab===t.k?'1px solid var(--border)':'1px solid transparent' }}>
              {t.l}
              {t.k==='pending' && (pending.length+inProgress.length)>0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-white font-bold"
                  style={{ background:'var(--red)', fontSize:9 }}>{pending.length+inProgress.length}</span>
              )}
            </button>
          ))}
        </div>
      </PageHeader>

      {tab === 'pending' && (
        <>
          {/* Pending absences */}
          {pending.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="font-display font-bold text-sm">Ausencias sin justificar</h2>
                <span className="badge badge-red">{pending.length}</span>
              </div>
              <div className="space-y-2">
                {pending.map(a => (
                  <div key={a.attendance_id} className="card-sm flex items-center gap-4" style={{ border:'1px solid var(--border)' }}>
                    <div className="flex-1">
                      <div className="font-medium text-sm" style={{ color:'var(--text)' }}>{a.title}</div>
                      <div className="text-xs mt-0.5" style={{ color:'var(--text3)' }}>
                        📅 {fmtDate(a.session_date)}{a.group_name && ` · ${a.group_name}`}
                      </div>
                    </div>
                    <Badge status={a.status} />
                    <button className="btn-primary text-xs py-2 px-4" onClick={() => { setSelected(a); reset(); }}>
                      Justificar →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* In progress */}
          {inProgress.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="font-display font-bold text-sm">En proceso</h2>
                <span className="badge badge-amber">{inProgress.length}</span>
              </div>
              <div className="space-y-2">
                {inProgress.map(a => (
                  <div key={a.attendance_id} className="card-sm flex items-center gap-4" style={{ border:'1px solid var(--amber-bg)' }}>
                    <div className="flex-1">
                      <div className="font-medium text-sm" style={{ color:'var(--text)' }}>{a.title}</div>
                      <div className="text-xs mt-0.5" style={{ color:'var(--text3)' }}>
                        {fmtDateShort(a.session_date)} · {a.reason?.slice(0,60)}{a.reason?.length>60?'...':''}
                      </div>
                    </div>
                    <Badge status={a.justification_status} />
                    <div className="flex gap-2">
                      {a.justification_id && (
                        <button className="btn-ghost text-xs py-1 px-3" onClick={() => setChatOpen(a.justification_id)}>
                          💬 Chat
                        </button>
                      )}
                      {a.justification_status === 'rejected' && (
                        <button className="btn-ghost text-xs py-1 px-3" onClick={() => { setSelected(a); reset(); }}>
                          Reenviar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pending.length === 0 && inProgress.length === 0 && (
            <Empty icon="✓" title="Sin pendientes" subtitle="No tienes ausencias sin justificar en este momento" />
          )}
        </>
      )}

      {tab === 'history' && (
        <div>
          <h2 className="font-display font-bold text-sm mb-3">Historial completo de justificaciones</h2>
          {myJust.length ? (
            <div className="space-y-3">
              {myJust.map(j => (
                <div key={j.id} className="card-sm" style={{ border:`1px solid ${j.status==='approved'?'var(--green-bg)':j.status==='rejected'?'var(--red-bg)':'var(--border)'}` }}>
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm" style={{ color:'var(--text)' }}>{j.session_title}</span>
                        <Badge status={j.status} />
                      </div>
                      <div className="text-xs" style={{ color:'var(--text3)' }}>
                        📅 {fmtDateShort(j.session_date)} · Enviada el {new Date(j.submitted_at).toLocaleDateString('es-CO')}
                      </div>
                      <div className="text-xs mt-2" style={{ color:'var(--text2)' }}>
                        <strong>Motivo:</strong> {j.reason}
                      </div>
                      {j.review_comment && (
                        <div className="mt-2 p-2 rounded text-xs" style={{ background:j.status==='rejected'?'var(--red-bg)':'var(--green-bg)', color:j.status==='rejected'?'var(--red)':'var(--green)' }}>
                          <strong>{j.status==='rejected'?'Motivo del rechazo':'Comentario'}:</strong> {j.review_comment}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {j.file_name && (
                        <button onClick={() => setViewFile(j)} className="chip text-xs flex items-center gap-1" style={{ cursor:'pointer' }}>
                          {j.file_type==='application/pdf'?'📄':'🖼'}
                          <span style={{ color:'var(--accent2)', fontSize:9 }}>VER</span>
                        </button>
                      )}
                      <button className="btn-ghost text-xs py-1 px-2" onClick={() => setChatOpen(j.id)}>
                        💬 Chat
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon="📋" title="Sin justificaciones enviadas" subtitle="Tu historial de justificaciones aparecerá aquí" />
          )}
        </div>
      )}

      {/* Submit modal */}
      <Modal open={!!selected} onClose={() => { setSelected(null); reset(); }} title="Enviar justificación"
        footer={
          <><button className="btn-ghost" onClick={() => setSelected(null)}>Cancelar</button>
          <button className="btn-primary" onClick={handleSubmit(onSubmit)} disabled={submitMutation.isPending}>
            {submitMutation.isPending ? 'Enviando...' : 'Enviar →'}
          </button></>
        }>
        {selected && (
          <div className="space-y-4">
            <div className="rounded-lg p-3" style={{ background:'var(--bg3)' }}>
              <div className="font-medium text-sm" style={{ color:'var(--text)' }}>{selected.title}</div>
              <div className="text-xs mt-1" style={{ color:'var(--text3)' }}>
                📅 {fmtDate(selected.session_date)}{selected.group_name && ` · ${selected.group_name}`}
              </div>
              <div className="mt-1.5"><Badge status={selected.status} /></div>
            </div>
            <div>
              <label className="label">Motivo de la ausencia *</label>
              <textarea className="input resize-none" rows={3}
                placeholder="Describe el motivo con detalle (cita médica, emergencia familiar...)"
                {...register('reason',{ required:'Requerido', minLength:{ value:10, message:'Mínimo 10 caracteres' } })} />
              {errors.reason && <p className="text-xs mt-1" style={{ color:'var(--red)' }}>{errors.reason.message}</p>}
            </div>
            <div>
              <label className="label">Documento de soporte <span style={{ color:'var(--text3)', fontWeight:400 }}>(opcional)</span></label>
              <div className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors"
                style={{ borderColor:'var(--border2)' }}
                onClick={() => fileRef.current?.click()}
                onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor='var(--border2)'}>
                <div className="text-2xl mb-1">📎</div>
                <div className="text-sm" style={{ color:'var(--text2)' }}>Adjunta un <span style={{ color:'var(--accent2)' }}>certificado, constancia o imagen</span></div>
                <div className="text-xs mt-1" style={{ color:'var(--text3)' }}>PDF, JPG, PNG · Máx 5MB</div>
                <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={e => { const f=e.target.files?.[0]; if(f) toast(`Archivo listo: ${f.name}`,{icon:'📎'}); }} />
              </div>
            </div>
            <Alert type="info"><span>ℹ</span><span className="text-xs">El administrador recibirá una notificación. Podrás chatear sobre esta justificación.</span></Alert>
          </div>
        )}
      </Modal>

      {/* Chat — uses ChatModal from ui/index */}
      {chatOpen && (() => {
        const j = myJust.find(x => x.id === chatOpen) || absences.find(x => x.justification_id === chatOpen);
        return (
          <ChatModal
            open={true}
            onClose={() => setChatOpen(null)}
            justificationId={chatOpen}
            memberName={`${user?.firstName} ${user?.lastName}`}
            sessionTitle={j?.session_title || j?.title || 'Sesión'}
            status={j?.status || j?.justification_status || 'pending'}
            reason={j?.reason || ''}
            currentUserId={user?.id}
          />
        );
      })()}

      {/* File viewer */}
      {viewFile && (
        <Modal open={true} onClose={() => setViewFile(null)} title="Documento adjunto" wide
          footer={<button className="btn-ghost" onClick={() => setViewFile(null)}>Cerrar</button>}>
          <div className="rounded-xl overflow-hidden" style={{ border:'1px solid var(--border)', minHeight:300 }}>
            <FileContent justificationId={viewFile.id} fileType={viewFile.file_type} />
          </div>
        </Modal>
      )}
    </div>
  );
}
