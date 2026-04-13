import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { usersAPI, justificationsAPI } from '../services/api';
import { PageHeader, Badge, Avatar, ProgressBar, Modal, Empty, Spinner, Alert } from '../components/ui';

// ── Justifications panel for a single user ───────────────────────────────────
function UserJustificationsModal({ user, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['user-justifications', user.id],
    queryFn: () => justificationsAPI.getAll({ userId: user.id }).then(r => r.data),
  });
  const [viewFile, setViewFile] = useState(null);
  const items = data?.justifications || [];

  return (
    <Modal open={true} onClose={onClose} title={`Justificaciones — ${user.first_name} ${user.last_name}`} wide
      footer={<button className="btn-ghost" onClick={onClose}>Cerrar</button>}>
      {isLoading ? <Spinner /> : items.length === 0 ? (
        <Empty icon="📋" title="Sin justificaciones" subtitle="Este usuario no ha enviado justificaciones" />
      ) : (
        <div className="space-y-2">
          {items.map(j => (
            <div key={j.id} className="rounded-lg p-3 flex items-start gap-3"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{j.session_title}</span>
                  <Badge status={j.status} />
                </div>
                <div className="text-xs mb-1" style={{ color: 'var(--text3)' }}>
                  {new Date(j.session_date + 'T12:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <div className="text-xs" style={{ color: 'var(--text2)' }}>{j.reason}</div>
                {j.review_comment && (
                  <div className="text-xs mt-1 italic" style={{ color: j.status === 'rejected' ? 'var(--red)' : 'var(--text3)' }}>
                    Revisor: "{j.review_comment}"
                  </div>
                )}
              </div>
              {j.file_name && (
                <button onClick={() => setViewFile(j)}
                  className="chip text-xs flex items-center gap-1 shrink-0"
                  style={{ cursor: 'pointer' }}
                  title="Ver documento">
                  <span>{j.file_type === 'application/pdf' ? '📄' : '🖼'}</span>
                  <span style={{ color: 'var(--accent2)', fontSize: 9 }}>VER</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {viewFile && <FileViewerModal justification={viewFile} onClose={() => setViewFile(null)} />}
    </Modal>
  );
}

// ── File viewer ───────────────────────────────────────────────────────────────
function FileViewerModal({ justification, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [fileType, setFileType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  React.useEffect(() => {
    let objectUrl = null;
    justificationsAPI.getFileBlobUrl(justification.id)
      .then(({ url, type }) => { objectUrl = url; setBlobUrl(url); setFileType(type); setLoading(false); })
      .catch(() => { setError('No se pudo cargar el archivo.'); setLoading(false); });
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [justification.id]);

  const isImage = fileType.startsWith('image/');
  const isPDF   = fileType === 'application/pdf';

  return (
    <Modal open={true} onClose={onClose} title={`Documento — ${justification.user_name || ''}`} wide
      footer={
        <>
          {blobUrl && <a href={blobUrl} download={justification.file_name} className="btn-ghost text-sm">⬇ Descargar</a>}
          <button className="btn-ghost" onClick={onClose}>Cerrar</button>
        </>
      }>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', minHeight: 300, background: 'var(--bg3)' }}>
        {loading && <div className="flex items-center justify-center h-64 text-sm" style={{ color: 'var(--text3)' }}>Cargando archivo...</div>}
        {error   && <div className="flex items-center justify-center h-64 text-sm" style={{ color: 'var(--red)' }}>{error}</div>}
        {!loading && !error && blobUrl && isPDF   && <iframe src={blobUrl} style={{ width: '100%', height: 480, border: 'none', display: 'block' }} />}
        {!loading && !error && blobUrl && isImage && (
          <div className="flex items-center justify-center p-4">
            <img src={blobUrl} alt="Documento" style={{ maxWidth: '100%', maxHeight: 480, objectFit: 'contain', borderRadius: 8 }} />
          </div>
        )}
        {!loading && !error && blobUrl && !isPDF && !isImage && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="text-4xl">📄</div>
            <div className="text-sm" style={{ color: 'var(--text2)' }}>{justification.file_name}</div>
            <a href={blobUrl} download={justification.file_name} className="btn-primary text-sm">⬇ Descargar archivo</a>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Main Users page ───────────────────────────────────────────────────────────
export default function Users() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [search, setSearch] = useState('');
  const [viewJustUser, setViewJustUser] = useState(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersAPI.getAll().then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (d) => editUser ? usersAPI.update(editUser.id, d) : usersAPI.create(d),
    onSuccess: () => {
      qc.invalidateQueries(['users']);
      toast.success(editUser ? 'Usuario actualizado' : 'Usuario creado exitosamente');
      setShowModal(false); reset(); setEditUser(null);
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Error'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id) => usersAPI.toggle(id),
    onSuccess: () => { qc.invalidateQueries(['users']); toast.success('Estado actualizado'); },
    onError: (e) => toast.error(e.response?.data?.error || 'Error'),
  });

  const openCreate = () => { setEditUser(null); reset({}); setShowModal(true); };
  const openEdit = (u) => {
    setEditUser(u);
    reset({ firstName: u.first_name, lastName: u.last_name, email: u.email, role: u.role, groupName: u.group_name });
    setShowModal(true);
  };

  const filtered = (data?.users || []).filter(u =>
    !search || `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );
  const atRisk = data?.users?.filter(u => u.isAtRisk)?.length || 0;

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Usuarios" subtitle={`${data?.users?.length || 0} usuarios registrados`}>
        <div className="relative">
          <input className="input text-sm pr-3" style={{ width: 220 }} placeholder="Buscar usuario..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn-primary text-sm" onClick={openCreate}>+ Nuevo usuario</button>
      </PageHeader>

      {atRisk > 0 && (
        <div className="mb-6">
          <Alert type="danger">
            <span>🚨</span>
            <span>{atRisk} usuario(s) por debajo del umbral mínimo de asistencia</span>
          </Alert>
        </div>
      )}

      <div className="card">
        {filtered.length ? (
          <table className="table-auto">
            <thead>
              <tr>
                <th>Usuario</th><th>Rol</th><th>Grupo</th>
                <th>Asistencia</th><th>Justificaciones</th><th>Último acceso</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar name={`${u.first_name} ${u.last_name}`} size="md" />
                      <div>
                        <div className="font-medium text-sm" style={{ color: 'var(--text)' }}>{u.first_name} {u.last_name}</div>
                        <div className="text-xs" style={{ color: 'var(--text3)' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><Badge status={u.role} /></td>
                  <td><span className="chip text-xs">{u.group_name || '—'}</span></td>
                  <td style={{ minWidth: 160 }}>
                    <ProgressBar value={parseFloat(u.attendancePct || 0)} />
                    {u.isAtRisk && (
                      <div className="text-xs mt-0.5" style={{ color: 'var(--red)' }}>⚠ En riesgo</div>
                    )}
                  </td>
                  <td>
                    <button
                      className="chip text-xs hover:border-accent2"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setViewJustUser(u)}
                      title="Ver justificaciones de este usuario"
                    >
                      📋 Ver docs
                    </button>
                  </td>
                  <td className="text-xs" style={{ color: 'var(--text3)' }}>
                    {u.last_login ? new Date(u.last_login).toLocaleDateString('es-CO') : 'Nunca'}
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-green' : 'badge-gray'}`}>
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1.5">
                      <button className="btn-ghost text-xs py-1 px-2" onClick={() => openEdit(u)}>Editar</button>
                      <button
                        className="text-xs px-2 py-1 rounded-md transition-all"
                        style={{
                          background: u.is_active ? 'var(--red-bg)' : 'var(--green-bg)',
                          color:      u.is_active ? 'var(--red)' : 'var(--green)',
                          border:     `1px solid ${u.is_active ? 'var(--red)' : 'var(--green)'}`,
                        }}
                        onClick={() => toggleMutation.mutate(u.id)}
                      >
                        {u.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty icon="◉"
            title={search ? 'Sin resultados' : 'Sin usuarios'}
            subtitle={search ? `No se encontró "${search}"` : 'Crea el primer usuario con el botón de arriba'} />
        )}
      </div>

      {/* Create/Edit modal */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setEditUser(null); reset(); }}
        title={editUser ? 'Editar usuario' : 'Nuevo usuario'}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn-primary" onClick={handleSubmit(d => saveMutation.mutate(d))} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando...' : editUser ? 'Actualizar' : 'Crear usuario'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre *</label>
              <input className="input" placeholder="Ana" {...register('firstName', { required: 'Requerido' })} />
              {errors.firstName && <p className="text-xs mt-1" style={{ color: 'var(--red)' }}>{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="label">Apellido *</label>
              <input className="input" placeholder="García" {...register('lastName', { required: 'Requerido' })} />
              {errors.lastName && <p className="text-xs mt-1" style={{ color: 'var(--red)' }}>{errors.lastName.message}</p>}
            </div>
          </div>
          <div>
            <label className="label">Correo electrónico *</label>
            <input className="input" type="email" placeholder="ana@empresa.com"
              {...register('email', { required: 'Requerido', pattern: { value: /^\S+@\S+$/, message: 'Email inválido' } })} />
            {errors.email && <p className="text-xs mt-1" style={{ color: 'var(--red)' }}>{errors.email.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Rol</label>
              <select className="input" {...register('role')}>
                <option value="member">Miembro</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div>
              <label className="label">Grupo</label>
              <input className="input" placeholder="Dev, Diseño, QA..." {...register('groupName')} />
            </div>
          </div>
          {!editUser && (
            <div>
              <label className="label">Contraseña temporal</label>
              <input className="input" type="password" placeholder="Mínimo 8 caracteres"
                {...register('password', { minLength: { value: 8, message: 'Mínimo 8 caracteres' } })} />
              {errors.password && <p className="text-xs mt-1" style={{ color: 'var(--red)' }}>{errors.password.message}</p>}
              <p className="text-xs mt-1" style={{ color: 'var(--text3)' }}>Si dejas vacío, el usuario puede usar "Olvidé mi contraseña"</p>
            </div>
          )}
        </div>
      </Modal>

      {/* User justifications panel */}
      {viewJustUser && <UserJustificationsModal user={viewJustUser} onClose={() => setViewJustUser(null)} />}
    </div>
  );
}
