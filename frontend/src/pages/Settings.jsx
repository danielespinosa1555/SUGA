import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import useAuthStore from '../context/authStore';
import { orgAPI, authAPI } from '../services/api';
import { PageHeader, Alert, Spinner } from '../components/ui';

const TABS = [
  { key:'org',       label:'Organización' },
  { key:'invite',    label:'Código de invitación' },
  { key:'threshold', label:'Umbrales' },
  { key:'security',  label:'Seguridad' },
  { key:'email',     label:'✉ Email / SMTP' },
  { key:'db',        label:'Base de datos' },
];

function InviteCodePanel({ orgId, inviteCode: initialCode, refreshUser }) {
  const [code, setCode] = React.useState(initialCode || '');
  const [copied, setCopied] = React.useState(false);
  const [regenerating, setRegenerating] = React.useState(false);
  React.useEffect(() => { if (initialCode) setCode(initialCode); }, [initialCode]);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regenerate = async () => {
    if (!window.confirm('¿Regenerar el código? El código actual dejará de funcionar.')) return;
    setRegenerating(true);
    try {
      const { authAPI: api } = await import('../services/api');
      const r = await api.regenerateInviteCode();
      setCode(r.data.inviteCode);
      await refreshUser();
      toast.success('Código regenerado exitosamente');
    } catch { toast.error('Error al regenerar'); }
    finally { setRegenerating(false); }
  };

  const formatted = code ? code.slice(0,4) + '-' + code.slice(4) : '--------';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* Main code display */}
      <div style={{ background:'var(--ink2)', border:'1px solid var(--wire2)', borderRadius:12, padding:28, textAlign:'center' }}>
        <p style={{ fontFamily:'"DM Mono",monospace', fontSize:10, color:'var(--text3)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:16 }}>
          // Código de invitación activo
        </p>
        <div style={{ fontFamily:'"Bebas Neue",sans-serif', fontSize:52, letterSpacing:'0.18em', color:'var(--go)', lineHeight:1, marginBottom:20 }}>
          {formatted}
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
          <button onClick={copy} className="btn btn-go" style={{ padding:'10px 24px', fontSize:12, letterSpacing:'0.04em' }}>
            {copied ? '✓ COPIADO' : 'COPIAR CÓDIGO'}
          </button>
          <button onClick={regenerate} disabled={regenerating} className="btn btn-outline" style={{ padding:'10px 20px', fontSize:12 }}>
            {regenerating ? 'Regenerando...' : '↺ Regenerar'}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div style={{ background:'var(--ink2)', border:'1px solid var(--wire)', borderRadius:12, padding:20 }}>
        <p style={{ fontFamily:'"DM Mono",monospace', fontSize:10, color:'var(--text3)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:16 }}>
          // Cómo compartir el código
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {[
            ['01', 'Comparte el código con los miembros de tu equipo por email, WhatsApp o el canal que uses.'],
            ['02', 'El miembro va a la página de registro y elige "Unirme con código".'],
            ['03', 'Ingresa el código de 8 caracteres — el sistema lo valida en tiempo real.'],
            ['04', 'Al completar el registro, el miembro queda automáticamente vinculado a tu organización.'],
          ].map(([n,t]) => (
            <div key={n} style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
              <span style={{ fontFamily:'"Bebas Neue",sans-serif', fontSize:20, color:'var(--go)', lineHeight:1, flexShrink:0 }}>{n}</span>
              <span style={{ fontFamily:'"Instrument Sans",sans-serif', fontSize:12, color:'var(--text2)', lineHeight:1.6 }}>{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Link */}
      <div style={{ background:'var(--ink2)', border:'1px solid var(--wire)', borderRadius:12, padding:18 }}>
        <p style={{ fontFamily:'"DM Mono",monospace', fontSize:10, color:'var(--text3)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:10 }}>
          // Enlace directo de registro
        </p>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <div style={{ flex:1, fontFamily:'"DM Mono",monospace', fontSize:11, color:'var(--text2)', background:'var(--ink3)', border:'1px solid var(--wire)', borderRadius:8, padding:'9px 14px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {window.location.origin}/register?join=1&code={code}
          </div>
          <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/register?join=1&code=${code}`); setCopied(true); setTimeout(()=>setCopied(false),2000); }}
            className="btn btn-outline" style={{ padding:'9px 14px', fontSize:11, flexShrink:0 }}>
            {copied ? '✓' : 'Copiar enlace'}
          </button>
        </div>
        <p style={{ fontFamily:'"DM Mono",monospace', fontSize:9, color:'var(--text4)', marginTop:8 }}>
          Comparte este enlace y el código ya estará prellenado en el formulario.
        </p>
      </div>

      <div style={{ padding:'12px 16px', borderRadius:10, background:'var(--danger-dim)', border:'1px solid rgba(255,64,64,0.15)' }}>
        <p style={{ fontFamily:'"DM Mono",monospace', fontSize:10, color:'var(--danger)', letterSpacing:'0.06em' }}>
          ⚠ REGENERAR el código invalida el anterior. Los miembros que aún no se hayan registrado necesitarán el nuevo código.
        </p>
      </div>
    </div>
  );
}


function EmailTestPanel() {
  const { user } = useAuthStore();
  const [testTo, setTestTo] = React.useState('');
  const [testing, setTesting] = React.useState(false);
  const [result, setResult] = React.useState(null);

  const runTest = async () => {
    const to = testTo.trim() || user?.email;
    if (!to) { toast.error('Ingresa un correo de destino'); return; }
    setTesting(true);
    setResult(null);
    try {
      const r = await authAPI.testEmail(to);
      setResult(r.data);
      if (r.data.result?.skipped) {
        toast.error('SMTP no configurado — revisa tu archivo .env');
      } else if (r.data.result?.error) {
        toast.error('Error al enviar: ' + r.data.result.error);
      } else {
        toast.success('✅ Correo enviado correctamente');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al probar');
      setResult({ error: err.response?.data?.error });
    } finally { setTesting(false); }
  };

  return (
    <div className="space-y-5">
      <div className="card">
        <h3 className="font-display font-bold text-sm mb-1">Configuración SMTP</h3>
        <p className="text-xs mb-5" style={{ color:'var(--text3)' }}>
          El correo se configura en el archivo <code style={{ color:'var(--accent2)', background:'var(--bg3)', padding:'1px 6px', borderRadius:4 }}>.env</code> del backend.
        </p>
        <div className="space-y-3">
          {[
            { key:'SMTP_HOST', desc:'Servidor SMTP (ej: smtp.gmail.com)', example:'smtp.gmail.com' },
            { key:'SMTP_PORT', desc:'Puerto (587 = TLS, 465 = SSL)', example:'587' },
            { key:'SMTP_USER', desc:'Tu correo Gmail u otro proveedor', example:'tucorreo@gmail.com' },
            { key:'SMTP_PASS', desc:'Contraseña de aplicación (NO tu clave normal)', example:'xxxx xxxx xxxx xxxx' },
            { key:'EMAIL_FROM', desc:'Nombre visible en "De:" del correo (opcional)', example:'noreply@tuempresa.com' },
          ].map(v => (
            <div key={v.key} className="flex items-start gap-3 p-3 rounded-lg" style={{ background:'var(--bg3)' }}>
              <div className="flex-1">
                <div className="font-mono text-sm font-bold" style={{ color:'var(--go)' }}>{v.key}</div>
                <div className="text-xs mt-0.5" style={{ color:'var(--text3)' }}>{v.desc}</div>
                <div className="text-xs mt-0.5 font-mono" style={{ color:'var(--text4)' }}>Ej: {v.example}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 rounded-lg" style={{ background:'rgba(255,183,71,0.08)', border:'1px solid rgba(255,183,71,0.2)' }}>
          <p className="text-xs font-medium" style={{ color:'var(--amber)' }}>⚠ Gmail — Contraseña de aplicación</p>
          <p className="text-xs mt-1" style={{ color:'var(--text2)', lineHeight:1.6 }}>
            Gmail NO permite usar tu contraseña normal. Debes crear una <strong>App Password</strong>:<br/>
            Google Account → Seguridad → Verificación en 2 pasos → <strong>Contraseñas de aplicación</strong>
          </p>
        </div>
      </div>

      <div className="card">
        <h3 className="font-display font-bold text-sm mb-4">Probar envío de correo</h3>
        <div className="flex gap-3 mb-4">
          <input
            className="input flex-1"
            type="email"
            placeholder={`Correo de prueba (default: ${user?.email})`}
            value={testTo}
            onChange={e => setTestTo(e.target.value)}
          />
          <button className="btn-primary" onClick={runTest} disabled={testing} style={{ whiteSpace:'nowrap' }}>
            {testing ? 'Enviando...' : '✉ Enviar prueba'}
          </button>
        </div>

        {result && (
          <div className="p-4 rounded-lg text-sm space-y-2" style={{
            background: result.result?.success ? 'var(--green-bg)' : 'var(--red-bg)',
            border: `1px solid ${result.result?.success ? 'var(--green)' : 'var(--red)'}`,
          }}>
            <div className="font-medium" style={{ color: result.result?.success ? 'var(--green)' : 'var(--red)' }}>
              {result.result?.success ? '✅ Correo enviado correctamente' :
               result.result?.skipped ? '⚠️ SMTP no configurado' :
               '❌ Error al enviar'}
            </div>
            <div className="text-xs space-y-1" style={{ color:'var(--text2)' }}>
              <div><strong>SMTP User:</strong> {result.smtpUser || '(no configurado en .env)'}</div>
              <div><strong>SMTP Host:</strong> {result.smtpHost}</div>
              {result.result?.messageId && <div><strong>Message ID:</strong> {result.result.messageId}</div>}
              {result.result?.error && <div><strong>Error:</strong> {result.result.error}</div>}
            </div>
            {result.result?.skipped && (
              <div className="text-xs mt-2" style={{ color:'var(--text3)' }}>
                Agrega SMTP_USER y SMTP_PASS al archivo .env del backend y reinicia el servidor.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const qc = useQueryClient();
  const { user, refreshUser } = useAuthStore();
  const [tab, setTab] = useState('org');
  const [threshold, setThreshold] = useState(75);
  const [twoFASetup, setTwoFASetup] = useState(null);

  const { register: regOrg, handleSubmit: hsOrg, setValue } = useForm();
  const { register: reg2fa, handleSubmit: hs2fa } = useForm();

  const { data: orgData, isLoading } = useQuery({
    queryKey: ['organization'],
    queryFn: () => orgAPI.get().then(r => r.data),
  });

  useEffect(() => {
    if (orgData?.organization) {
      setValue('name',  orgData.organization.name);
      setValue('email', orgData.organization.email || '');
      setThreshold(orgData.organization.threshold || 75);
    }
  }, [orgData]);

  const orgMutation = useMutation({
    mutationFn: d => orgAPI.update({ ...d, threshold }),
    onSuccess: () => { qc.invalidateQueries(['organization']); toast.success('Configuración guardada ✓'); },
    onError: () => toast.error('Error al guardar'),
  });

  const setup2FAMutation = useMutation({
    mutationFn: () => authAPI.setup2FA(),
    onSuccess: res => setTwoFASetup(res.data),
    onError: () => toast.error('Error al configurar 2FA'),
  });

  const verify2FAMutation = useMutation({
    mutationFn: d => authAPI.verify2FA(d.code),
    onSuccess: () => { toast.success('2FA activado correctamente ✓'); refreshUser(); setTwoFASetup(null); },
    onError: () => toast.error('Código inválido'),
  });

  if (isLoading) return <Spinner />;
  const org = orgData?.organization;

  return (
    <div>
      <PageHeader title="Configuración" subtitle="Ajusta el sistema para tu organización" />

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl mb-7 w-fit" style={{ background:'var(--bg3)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm transition-all"
            style={{
              background: tab===t.key ? 'var(--bg2)' : 'transparent',
              color:      tab===t.key ? 'var(--text)' : 'var(--text3)',
              border:     tab===t.key ? '1px solid var(--border)' : '1px solid transparent',
              fontWeight: tab===t.key ? 500 : 400,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ORG ── */}
      {tab === 'org' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-display font-bold text-sm mb-5">Información de la organización</h3>
            <form onSubmit={hsOrg(d => orgMutation.mutate(d))} className="space-y-4">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" placeholder="Mi Empresa S.A.S." {...regOrg('name', { required:true })} />
              </div>
              <div>
                <label className="label">Correo de contacto</label>
                <input className="input" type="email" placeholder="admin@empresa.com" {...regOrg('email')} />
              </div>
              <div>
                <label className="label">Identificador (slug)</label>
                <input className="input" value={org?.slug||''} disabled style={{ opacity:0.5, cursor:'not-allowed' }} />
                <p className="text-xs mt-1" style={{ color:'var(--text3)' }}>No modificable — identifica tu organización en el sistema</p>
              </div>
              <button type="submit" className="btn-primary text-sm" disabled={orgMutation.isPending}>
                {orgMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </form>
          </div>

          <div className="card">
            <h3 className="font-display font-bold text-sm mb-5">Mi perfil</h3>
            <div className="flex items-center gap-4 p-4 rounded-xl mb-5" style={{ background:'var(--bg3)' }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center font-display font-black text-xl"
                style={{ background:'linear-gradient(135deg,var(--accent),var(--purple))', color:'white' }}>
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div>
                <div className="font-display font-bold">{user?.firstName} {user?.lastName}</div>
                <div className="text-sm" style={{ color:'var(--text3)' }}>{user?.email}</div>
                <span className="badge badge-purple mt-1">Administrador</span>
              </div>
            </div>
            <Alert type="info">
              <span>ℹ</span>
              <span className="text-xs">Para cambiar tu nombre o contraseña, contáctate con el desarrollador o actualiza directamente en la base de datos.</span>
            </Alert>
          </div>
        </div>
      )}

      {/* ── THRESHOLD ── */}
      {tab === 'threshold' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-display font-bold text-sm mb-5">Umbral de asistencia mínima</h3>
            <div className="mb-6">
              <div className="flex items-end gap-4 mb-3">
                <input type="range" min={50} max={100} step={1} value={threshold}
                  onChange={e => setThreshold(parseInt(e.target.value))} className="flex-1" />
                <div className="font-display font-black text-4xl" style={{ color:'var(--accent2)', minWidth:80, textAlign:'right' }}>
                  {threshold}%
                </div>
              </div>
              <div className="flex justify-between text-xs" style={{ color:'var(--text3)' }}>
                <span>50% (mínimo)</span>
                <span>75% (recomendado)</span>
                <span>100%</span>
              </div>
            </div>
            <Alert type="warning">
              <span>⚠</span>
              <span className="text-xs">Los usuarios con asistencia menor a <strong>{threshold}%</strong> serán marcados como "en riesgo" y aparecerán en alertas. Aplica tanto a admins como a miembros.</span>
            </Alert>
            <div className="mt-5 space-y-3">
              <label className="flex items-center gap-3 text-sm cursor-pointer" style={{ color:'var(--text2)' }}>
                <input type="checkbox" defaultChecked />
                <div>
                  <div>Alerta visual en dashboard</div>
                  <div className="text-xs mt-0.5" style={{ color:'var(--text3)' }}>Sección de alertas con usuarios en riesgo</div>
                </div>
              </label>
              <label className="flex items-center gap-3 text-sm cursor-pointer" style={{ color:'var(--text2)' }}>
                <input type="checkbox" defaultChecked />
                <div>
                  <div>Notificación al usuario al bajar del umbral</div>
                  <div className="text-xs mt-0.5" style={{ color:'var(--text3)' }}>Se envía automáticamente tras guardar asistencia</div>
                </div>
              </label>
            </div>
            <button className="btn-primary text-sm mt-5"
              onClick={() => orgMutation.mutate({ name:org?.name, email:org?.email })}
              disabled={orgMutation.isPending}>
              Guardar umbral
            </button>
          </div>

          <div className="card">
            <h3 className="font-display font-bold text-sm mb-5">Rangos de color</h3>
            <div className="space-y-3">
              {[
                { l:'Óptimo',  r:`${threshold+10}% — 100%`, c:'green',  d:'Asistencia excelente' },
                { l:'Alerta',  r:`${threshold}% — ${threshold+9}%`, c:'amber', d:'Zona de advertencia' },
                { l:'Riesgo',  r:`0% — ${threshold-1}%`, c:'red',   d:'Por debajo del mínimo' },
              ].map(r => (
                <div key={r.l} className="flex items-center gap-3 p-3 rounded-lg"
                  style={{ background:'var(--bg3)', borderLeft:`3px solid var(--${r.c})` }}>
                  <div className="flex-1">
                    <div className="font-medium text-sm" style={{ color:'var(--text)' }}>{r.l}</div>
                    <div className="text-xs" style={{ color:'var(--text3)' }}>{r.d}</div>
                  </div>
                  <span className="font-display font-bold text-sm" style={{ color:`var(--${r.c})` }}>{r.r}</span>
                </div>
              ))}
            </div>
            <Alert type="info" className="mt-4">
              <span>ℹ</span>
              <span className="text-xs">El porcentaje de asistencia se calcula como: (Presentes + Justificados + Tardanzas) / Total de sesiones × 100</span>
            </Alert>
          </div>
        </div>
      )}

      {/* ── SECURITY ── */}
      {tab === 'security' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-display font-bold text-sm mb-5">Métodos de autenticación</h3>
            <div className="space-y-3">
              {[
                { l:'Email + contraseña (bcrypt)',  s:'Hash seguro con sal, rounds: 12', on:true },
                { l:'Google OAuth 2.0',             s:'Inicio de sesión con cuenta Google', on:true },
                { l:'JWT para sesiones',            s:'Token firmado, expira automáticamente', on:true },
                { l:'Recuperación de contraseña',   s:'Token de un solo uso, expira en 1h', on:true },
              ].map(item => (
                <div key={item.l} className="flex items-center justify-between p-3 rounded-lg" style={{ background:'var(--bg3)' }}>
                  <div>
                    <div className="text-sm font-medium" style={{ color:'var(--text)' }}>{item.l}</div>
                    <div className="text-xs mt-0.5" style={{ color:'var(--text3)' }}>{item.s}</div>
                  </div>
                  <span className={`badge ${item.on?'badge-green':'badge-gray'}`}>{item.on?'Activo':'Inactivo'}</span>
                </div>
              ))}
              <div className="p-3 rounded-lg" style={{ background:'var(--bg3)' }}>
                <div className="text-sm font-medium mb-2" style={{ color:'var(--text)' }}>Expiración de sesión JWT</div>
                <select className="input text-sm">
                  <option value="8h">8 horas</option>
                  <option value="24h">24 horas</option>
                  <option value="7d">7 días</option>
                </select>
                <p className="text-xs mt-1.5" style={{ color:'var(--text3)' }}>Configura JWT_EXPIRES_IN en el .env del servidor</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="font-display font-bold text-sm mb-5">Autenticación de dos factores (2FA)</h3>
            {user?.twoFactorEnabled ? (
              <div className="space-y-4">
                <Alert type="success">
                  <span>✓</span>
                  <span>2FA activado en tu cuenta de administrador</span>
                </Alert>
                <p className="text-xs" style={{ color:'var(--text3)' }}>
                  Cada vez que inicies sesión deberás ingresar el código de 6 dígitos de tu app de autenticación (Google Authenticator, Authy, etc.)
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <Alert type="warning">
                  <span>⚠</span>
                  <span className="text-xs">2FA no activado — recomendado para administradores</span>
                </Alert>
                <p className="text-sm" style={{ color:'var(--text2)' }}>
                  Añade una capa extra de seguridad. Necesitas una app como Google Authenticator, Authy o Microsoft Authenticator.
                </p>
                {!twoFASetup ? (
                  <button className="w-full btn-primary justify-center py-3 text-sm"
                    onClick={() => setup2FAMutation.mutate()}
                    disabled={setup2FAMutation.isPending}>
                    {setup2FAMutation.isPending ? 'Generando...' : '🔐 Activar 2FA'}
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl text-center" style={{ background:'var(--bg3)' }}>
                      <div className="text-xs mb-2" style={{ color:'var(--text3)' }}>
                        Agrega esta clave en tu app de autenticación
                      </div>
                      <div className="font-mono font-bold text-base tracking-widest break-all"
                        style={{ color:'var(--accent2)' }}>
                        {twoFASetup.secret}
                      </div>
                    </div>
                    <form onSubmit={hs2fa(verify2FAMutation.mutate)} className="flex gap-2">
                      <input className="input flex-1 text-center font-mono tracking-widest"
                        maxLength={6} placeholder="000000" {...reg2fa('code',{ required:true, minLength:6 })} />
                      <button type="submit" className="btn-primary px-4 text-sm" disabled={verify2FAMutation.isPending}>
                        {verify2FAMutation.isPending ? '...' : 'Verificar'}
                      </button>
                    </form>
                    <p className="text-xs text-center" style={{ color:'var(--text3)' }}>
                      Ingresa el código de 6 dígitos que muestra la app
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── INVITE CODE ── */}
      {tab === 'invite' && (
        <InviteCodePanel orgId={user?.organizationId} inviteCode={user?.inviteCode} refreshUser={refreshUser} />
      )}


      {/* ── EMAIL TEST ── */}
      {tab === 'email' && (
        <EmailTestPanel />
      )}

      {/* ── DB ── */}
      {tab === 'db' && (
        <div className="card">
          <h3 className="font-display font-bold text-sm mb-5">Esquema PostgreSQL</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { name:'organizations', desc:'Datos de la organización y configuración' },
              { name:'users',        desc:'Usuarios con roles (admin/member)' },
              { name:'sessions',     desc:'Eventos donde se registra asistencia' },
              { name:'attendance',   desc:'Registro por usuario + sesión (todos los roles)' },
              { name:'justifications', desc:'Justificaciones con flujo de aprobación' },
              { name:'notifications',  desc:'Alertas del sistema para usuarios' },
              { name:'password_reset_tokens', desc:'Tokens de recuperación de contraseña' },
            ].map(t => (
              <div key={t.name} className="flex items-start gap-3 p-3 rounded-lg" style={{ background:'var(--bg3)' }}>
                <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background:'var(--green)' }} />
                <div>
                  <div className="font-mono text-sm" style={{ color:'var(--accent2)' }}>{t.name}</div>
                  <div className="text-xs mt-0.5" style={{ color:'var(--text3)' }}>{t.desc}</div>
                </div>
                <span className="badge badge-green ml-auto">Activa</span>
              </div>
            ))}
            <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background:'var(--bg3)', borderLeft:'2px solid var(--blue)' }}>
              <div>
                <div className="font-mono text-sm" style={{ color:'var(--blue)' }}>v_attendance_summary</div>
                <div className="text-xs mt-0.5" style={{ color:'var(--text3)' }}>Vista SQL — resumen de asistencia por usuario (todos los roles)</div>
              </div>
              <span className="badge badge-blue ml-auto">Vista</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="btn-ghost text-sm" onClick={() => toast.success('Conexión verificada ✓')}>
              ✓ Verificar conexión
            </button>
            <button className="btn-ghost text-sm" onClick={() => toast('Para backup usa: pg_dump -U postgres suga_db', { icon:'💾', duration:5000 })}>
              💾 Instrucciones backup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
