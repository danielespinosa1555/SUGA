import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import useAuthStore from '../context/authStore';
import { authAPI } from '../services/api';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { refreshUser } = useAuthStore();
  const [needsOrg, setNeedsOrg] = useState(false);
  const [orgMode, setOrgMode] = useState('create'); // 'create' | 'join'
  const [inviteInfo, setInviteInfo] = useState(null);
  const [checkingCode, setCheckingCode] = useState(false);
  const [saving, setSaving] = useState(false);
  const createForm = useForm();
  const joinForm = useForm();
  const watchedCode = joinForm.watch('inviteCode');

  useEffect(() => {
    const t     = params.get('token');
    const needs = params.get('needsOrg') === 'true';
    const error = params.get('error');

    if (error) { toast.error('Error al iniciar sesión con Google'); navigate('/login'); return; }
    if (!t) { navigate('/login'); return; }

    // Store token immediately
    localStorage.setItem('suga_token', t);

    if (needs) { setNeedsOrg(true); return; }

    // Auto-load user into store and redirect
    authAPI.getMe().then(res => {
      const user = res.data;
      localStorage.setItem('suga_user', JSON.stringify(user));
      // Update Zustand store so PrivateRoute passes
      useAuthStore.setState({ user, token: t });
      navigate(user.role === 'admin' ? '/dashboard' : '/my-attendance', { replace: true });
    }).catch(() => {
      toast.error('Error al cargar tu perfil');
      localStorage.removeItem('suga_token');
      navigate('/login');
    });
  }, []);

  // Auto-validate invite code
  useEffect(() => {
    const code = watchedCode?.replace(/\s/g,'').toUpperCase();
    if (code?.length === 8) {
      setCheckingCode(true);
      authAPI.validateInviteCode(code)
        .then(r => setInviteInfo(r.data))
        .catch(() => setInviteInfo(null))
        .finally(() => setCheckingCode(false));
    } else { setInviteInfo(null); }
  }, [watchedCode]);

  const createOrg = async (data) => {
    setSaving(true);
    try {
      const res = await authAPI.setupOrganization({ organizationName: data.orgName });
      const newToken = res.data.token;
      localStorage.setItem('suga_token', newToken);
      const me = await authAPI.getMe();
      const user = me.data;
      localStorage.setItem('suga_user', JSON.stringify(user));
      useAuthStore.setState({ user, token: newToken });
      toast.success('¡Organización creada exitosamente!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear organización');
    } finally { setSaving(false); }
  };

  const joinOrg = async (data) => {
    setSaving(true);
    try {
      const r = await authAPI.join({
        firstName: data.firstName, lastName: data.lastName,
        email: data.email, password: data.password,
        inviteCode: data.inviteCode.replace(/\s/g,'').toUpperCase(),
      });
      const { token: newToken, user, organizationName } = r.data;
      const fullUser = { ...user, organizationName };
      localStorage.setItem('suga_token', newToken);
      localStorage.setItem('suga_user', JSON.stringify(fullUser));
      useAuthStore.setState({ user: fullUser, token: newToken });
      toast.success(`¡Bienvenido a ${organizationName}!`);
      navigate('/my-attendance', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al unirse');
    } finally { setSaving(false); }
  };

  if (!needsOrg) {
    return (
      <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', background:'var(--ink)' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ width:48, height:48, border:'3px solid var(--go)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 16px' }} />
          <div style={{ fontFamily:'"DM Mono"', fontSize:11, color:'var(--text3)', letterSpacing:'0.1em' }}>INICIANDO SESIÓN...</div>
        </div>
      </div>
    );
  }

  const S = {
    label: { fontFamily:'"DM Mono",monospace', fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text3)', display:'block', marginBottom:5 },
    err:   { color:'var(--danger)', fontSize:10, marginTop:4, fontFamily:'"DM Mono",monospace' },
    row:   { marginBottom:13 },
  };

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--ink)' }}>
      {/* Left panel */}
      <div style={{ flex:'0 0 44%', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', justifyContent:'space-between', padding:48, background:'var(--ink2)', borderRight:'1px solid var(--wire)' }}>
        <div className="grid-lines" style={{ position:'absolute', inset:0 }} />
        <div style={{ position:'absolute', right:0, top:0, bottom:0, width:3, background:'var(--go)' }} />
        <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:40, height:40, background:'var(--go)', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontFamily:'"Bebas Neue"', fontSize:24, color:'var(--ink)', lineHeight:1 }}>S</span>
          </div>
          <span style={{ fontFamily:'"Bebas Neue"', fontSize:22, letterSpacing:'0.12em', color:'var(--text)' }}>SUGA</span>
        </div>

        <div style={{ position:'relative', zIndex:1, flex:1, display:'flex', flexDirection:'column', justifyContent:'center', gap:24, marginTop:32 }}>
          <div>
            <p style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--text3)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:14 }}>
              // ¿Cómo quieres empezar?
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { key:'create', icon:'＋', title:'Crear organización', desc:'Serás el administrador. Tu equipo se une con el código que recibirás.' },
                { key:'join',   icon:'→',  title:'Unirme con código',  desc:'Tu admin ya tiene SUGA. Usa el código de 8 caracteres que te dieron.' },
              ].map(opt => (
                <div key={opt.key} onClick={() => setOrgMode(opt.key)} style={{
                  padding:'16px 18px', borderRadius:10, cursor:'pointer', transition:'all 0.15s',
                  background: orgMode===opt.key ? 'var(--go-dim)' : 'var(--ink3)',
                  border:`1px solid ${orgMode===opt.key ? 'rgba(200,255,0,0.3)' : 'var(--wire)'}`,
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:5 }}>
                    <span style={{ fontFamily:'"Bebas Neue"', fontSize:18, color: orgMode===opt.key ? 'var(--go)' : 'var(--text)' }}>{opt.icon} {opt.title}</span>
                  </div>
                  <p style={{ fontFamily:'"Instrument Sans"', fontSize:11, color:'var(--text2)', lineHeight:1.5, margin:0 }}>{opt.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p style={{ position:'relative', zIndex:1, fontFamily:'"DM Mono"', fontSize:9, color:'var(--text4)', letterSpacing:'0.06em' }}>© 2024 SUGA · Conectado con Google</p>
      </div>

      {/* Right form */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 48px', overflowY:'auto', background:'var(--ink)' }}>
        <div style={{ width:'100%', maxWidth:380 }} className="anim-up">

          {orgMode === 'create' ? (
            <>
              <p style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--text3)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:8 }}>// Nueva organización</p>
              <h2 style={{ fontFamily:'"Bebas Neue"', fontSize:34, color:'var(--text)', letterSpacing:'0.04em', lineHeight:0.95, marginBottom:28 }}>Configura tu espacio</h2>
              <form onSubmit={createForm.handleSubmit(createOrg)}>
                <div style={S.row}>
                  <label style={S.label}>Nombre de la organización *</label>
                  <input className="field" placeholder="TechCorp S.A.S., Universidad X..."
                    {...createForm.register('orgName',{ required:'Requerido', minLength:{ value:2, message:'Mínimo 2 caracteres' } })} />
                  {createForm.formState.errors.orgName && <p style={S.err}>{createForm.formState.errors.orgName.message}</p>}
                </div>
                <div style={{ marginTop:6, marginBottom:20, padding:'10px 14px', borderRadius:8, background:'var(--ink3)', border:'1px solid var(--wire)', fontSize:11, color:'var(--text2)', fontFamily:'"Instrument Sans"', lineHeight:1.6 }}>
                  Serás el <strong>administrador</strong>. Podrás invitar miembros desde el panel con un código único.
                </div>
                <button type="submit" disabled={saving} className="btn btn-go" style={{ width:'100%', justifyContent:'center', padding:13, fontSize:13, letterSpacing:'0.04em' }}>
                  {saving ? 'Creando...' : 'CREAR ORGANIZACIÓN →'}
                </button>
              </form>
            </>
          ) : (
            <>
              <p style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--text3)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:8 }}>// Unirse con código</p>
              <h2 style={{ fontFamily:'"Bebas Neue"', fontSize:34, color:'var(--text)', letterSpacing:'0.04em', lineHeight:0.95, marginBottom:28 }}>Ingresa tu código</h2>
              <form onSubmit={joinForm.handleSubmit(joinOrg)}>
                <div style={{ marginBottom:16 }}>
                  <label style={S.label}>Código de invitación (8 caracteres)</label>
                  <input className="field" placeholder="XKQT7BPM"
                    style={{ fontFamily:'"Bebas Neue"', fontSize:28, letterSpacing:'0.2em', textAlign:'center', textTransform:'uppercase', padding:'14px' }}
                    {...joinForm.register('inviteCode',{ required:'Requerido', minLength:{ value:8,message:'8 caracteres' }, maxLength:{ value:8,message:'8 caracteres' } })}
                    onChange={e => { const v = e.target.value.replace(/\s/g,'').toUpperCase().slice(0,8); joinForm.setValue('inviteCode', v, { shouldValidate:true }); }}
                  />
                  {joinForm.formState.errors.inviteCode && <p style={S.err}>{joinForm.formState.errors.inviteCode.message}</p>}
                  {checkingCode && <p style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--text3)', marginTop:6 }}>Verificando...</p>}
                  {inviteInfo && (
                    <div style={{ marginTop:8, padding:'10px 14px', borderRadius:8, background:'var(--safe-dim)', border:'1px solid rgba(0,200,122,0.2)' }}>
                      <p style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--safe)', margin:0 }}>
                        ✓ <strong>{inviteInfo.organizationName}</strong> · {inviteInfo.memberCount} miembro(s)
                      </p>
                    </div>
                  )}
                  {watchedCode?.length === 8 && !inviteInfo && !checkingCode && (
                    <div style={{ marginTop:8, padding:'10px 14px', borderRadius:8, background:'var(--danger-dim)', border:'1px solid rgba(255,64,64,0.2)' }}>
                      <p style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--danger)', margin:0 }}>✗ Código inválido. Verifica con tu administrador.</p>
                    </div>
                  )}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:13 }}>
                  <div>
                    <label style={S.label}>Nombre</label>
                    <input className="field" placeholder="Ana" {...joinForm.register('firstName',{ required:'Requerido' })} />
                    {joinForm.formState.errors.firstName && <p style={S.err}>{joinForm.formState.errors.firstName.message}</p>}
                  </div>
                  <div>
                    <label style={S.label}>Apellido</label>
                    <input className="field" placeholder="García" {...joinForm.register('lastName',{ required:'Requerido' })} />
                    {joinForm.formState.errors.lastName && <p style={S.err}>{joinForm.formState.errors.lastName.message}</p>}
                  </div>
                </div>
                <div style={S.row}>
                  <label style={S.label}>Correo electrónico</label>
                  <input className="field" type="email" placeholder="ana@empresa.com"
                    {...joinForm.register('email',{ required:'Requerido', pattern:{ value:/^\S+@\S+$/, message:'Email inválido' } })} />
                  {joinForm.formState.errors.email && <p style={S.err}>{joinForm.formState.errors.email.message}</p>}
                </div>
                <div style={S.row}>
                  <label style={S.label}>Contraseña</label>
                  <input className="field" type="password" placeholder="Mín. 8 caracteres"
                    {...joinForm.register('password',{ required:'Requerido', minLength:{ value:8, message:'Mín. 8 chars' } })} />
                  {joinForm.formState.errors.password && <p style={S.err}>{joinForm.formState.errors.password.message}</p>}
                </div>
                <button type="submit" disabled={saving || !inviteInfo} className="btn btn-go"
                  style={{ width:'100%', justifyContent:'center', padding:13, fontSize:13, letterSpacing:'0.04em', marginTop:8, opacity:(!inviteInfo)?0.4:1 }}>
                  {saving ? 'Uniéndome...' : 'UNIRME →'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
