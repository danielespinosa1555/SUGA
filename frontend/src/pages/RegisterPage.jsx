import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import useAuthStore from '../context/authStore';
import { authAPI } from '../services/api';

const Eye = ({ off }) => off
  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10 10 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9 9 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;

export default function RegisterPage() {
  const { register: regStore, loading } = useAuthStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('join') ? 'join' : 'create'); // 'create' | 'join'
  const [showPass, setShowPass] = useState(false);
  const [inviteInfo, setInviteInfo] = useState(null); // { organizationName, memberCount }
  const [checkingCode, setCheckingCode] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);

  // Create org form
  const createForm = useForm();
  const pass = createForm.watch('password');

  // Join form
  const joinForm = useForm({ defaultValues: { inviteCode: params.get('code') || '' } });
  const watchedCode = joinForm.watch('inviteCode');

  // Auto-validate invite code as user types
  useEffect(() => {
    const code = watchedCode?.replace(/\s/g, '').toUpperCase();
    if (code?.length === 8) {
      setCheckingCode(true);
      authAPI.validateInviteCode(code)
        .then(r => setInviteInfo(r.data))
        .catch(() => setInviteInfo(null))
        .finally(() => setCheckingCode(false));
    } else {
      setInviteInfo(null);
    }
  }, [watchedCode]);

  const onCreateSubmit = async (data) => {
    if (data.password !== data.confirmPassword) { toast.error('Las contraseñas no coinciden'); return; }
    const result = await regStore({ firstName:data.firstName, lastName:data.lastName, email:data.email, password:data.password, organizationName:data.organizationName });
    if (result?.success) {
      toast.success('¡Organización creada! Bienvenido a SUGA');
      navigate('/dashboard');
    } else toast.error(result?.error || 'Error al crear cuenta');
  };

  const onJoinSubmit = async (data) => {
    setJoinLoading(true);
    try {
      const r = await authAPI.join({
        firstName: data.firstName, lastName: data.lastName,
        email: data.email, password: data.password,
        inviteCode: data.inviteCode.replace(/\s/g,'').toUpperCase(),
      });
      const { token, user, organizationName } = r.data;
      localStorage.setItem('suga_token', token);
      localStorage.setItem('suga_user', JSON.stringify({ ...user, firstName:user.firstName, lastName:user.lastName, organizationName }));
      toast.success(`¡Bienvenido a ${organizationName}!`);
      navigate('/my-attendance');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al unirse');
    } finally { setJoinLoading(false); }
  };

  const S = { // common styles
    label: { fontFamily:'"DM Mono",monospace', fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text3)', display:'block', marginBottom:5 },
    err:   { color:'var(--danger)', fontSize:10, marginTop:4, fontFamily:'"DM Mono",monospace' },
    row:   { marginBottom:13 },
  };

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--ink)' }}>

      {/* ── LEFT PANEL ── */}
      <div style={{ flex:'0 0 44%', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', justifyContent:'space-between', padding:48, background:'var(--ink2)', borderRight:'1px solid var(--wire)' }}>
        <div className="grid-lines" style={{ position:'absolute', inset:0 }} />
        <div style={{ position:'absolute', right:0, top:0, bottom:0, width:3, background:'var(--go)' }} />

        {/* Logo */}
        <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:40, height:40, background:'var(--go)', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontFamily:'"Bebas Neue"', fontSize:24, color:'var(--ink)', lineHeight:1 }}>S</span>
          </div>
          <span style={{ fontFamily:'"Bebas Neue"', fontSize:22, letterSpacing:'0.12em', color:'var(--text)', lineHeight:1 }}>SUGA</span>
        </div>

        {/* Mode tabs */}
        <div style={{ position:'relative', zIndex:1, flex:1, display:'flex', flexDirection:'column', justifyContent:'center', gap:32 }}>
          <div>
            <p style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--text3)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:14 }}>
              // Elige cómo empezar
            </p>

            {/* Mode selector */}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div onClick={() => setMode('create')} style={{
                padding:'18px 20px', borderRadius:10, cursor:'pointer', transition:'all 0.15s',
                background: mode === 'create' ? 'var(--go-dim)' : 'var(--ink3)',
                border: `1px solid ${mode === 'create' ? 'rgba(200,255,0,0.3)' : 'var(--wire)'}`,
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
                  <div style={{ width:28, height:28, borderRadius:6, background: mode==='create' ? 'var(--go)' : 'var(--ink4)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={mode==='create'?'var(--ink)':'var(--text3)'} strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                  </div>
                  <span style={{ fontFamily:'"Bebas Neue"', fontSize:20, color: mode==='create' ? 'var(--go)' : 'var(--text)', letterSpacing:'0.04em' }}>
                    Crear organización
                  </span>
                </div>
                <p style={{ fontFamily:'"Instrument Sans"', fontSize:12, color:'var(--text2)', lineHeight:1.5, marginLeft:40 }}>
                  Eres el administrador. Tu equipo se une con el código que recibirás.
                </p>
              </div>

              <div onClick={() => setMode('join')} style={{
                padding:'18px 20px', borderRadius:10, cursor:'pointer', transition:'all 0.15s',
                background: mode === 'join' ? 'var(--go-dim)' : 'var(--ink3)',
                border: `1px solid ${mode === 'join' ? 'rgba(200,255,0,0.3)' : 'var(--wire)'}`,
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
                  <div style={{ width:28, height:28, borderRadius:6, background: mode==='join' ? 'var(--go)' : 'var(--ink4)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={mode==='join'?'var(--ink)':'var(--text3)'} strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M21 12H9"/></svg>
                  </div>
                  <span style={{ fontFamily:'"Bebas Neue"', fontSize:20, color: mode==='join' ? 'var(--go)' : 'var(--text)', letterSpacing:'0.04em' }}>
                    Unirme con código
                  </span>
                </div>
                <p style={{ fontFamily:'"Instrument Sans"', fontSize:12, color:'var(--text2)', lineHeight:1.5, marginLeft:40 }}>
                  Tu administrador te dio un código de 8 caracteres. Úsalo aquí.
                </p>
              </div>
            </div>
          </div>

          {/* Info about invite code system */}
          <div style={{ padding:16, borderRadius:10, background:'var(--ink4)', border:'1px solid var(--wire)' }}>
            <p style={{ fontFamily:'"DM Mono"', fontSize:9, color:'var(--text3)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:8 }}>¿CÓMO FUNCIONA?</p>
            {[
              ['01', 'Admin crea la organización y recibe un código único'],
              ['02', 'Comparte el código con tu equipo (ej: XKQT-7BPM)'],
              ['03', 'Cada miembro se registra usando ese código'],
            ].map(([n,t]) => (
              <div key={n} style={{ display:'flex', gap:10, marginBottom:6 }}>
                <span style={{ fontFamily:'"Bebas Neue"', fontSize:16, color:'var(--go)', flexShrink:0 }}>{n}</span>
                <span style={{ fontFamily:'"Instrument Sans"', fontSize:11, color:'var(--text2)', lineHeight:1.5 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ position:'relative', zIndex:1, fontFamily:'"DM Mono"', fontSize:9, color:'var(--text4)', letterSpacing:'0.06em' }}>
          © 2024 SUGA · Sistema Universal de Gestión de Asistencia
        </p>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 48px', overflowY:'auto', background:'var(--ink)' }}>
        <div style={{ width:'100%', maxWidth:380 }} className="anim-up">

          {mode === 'create' ? (
            /* ── CREATE ORG FORM ── */
            <>
              <p style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--text3)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:8 }}>// Nueva organización</p>
              <h2 style={{ fontFamily:'"Bebas Neue"', fontSize:34, color:'var(--text)', letterSpacing:'0.04em', lineHeight:0.95, marginBottom:28 }}>Crear cuenta admin</h2>

              <form onSubmit={createForm.handleSubmit(onCreateSubmit)}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:13 }}>
                  <div>
                    <label style={S.label}>Nombre</label>
                    <input className="field" placeholder="Ana" {...createForm.register('firstName',{required:'Requerido'})} />
                    {createForm.formState.errors.firstName && <p style={S.err}>{createForm.formState.errors.firstName.message}</p>}
                  </div>
                  <div>
                    <label style={S.label}>Apellido</label>
                    <input className="field" placeholder="García" {...createForm.register('lastName',{required:'Requerido'})} />
                    {createForm.formState.errors.lastName && <p style={S.err}>{createForm.formState.errors.lastName.message}</p>}
                  </div>
                </div>
                <div style={S.row}>
                  <label style={S.label}>Nombre de la organización</label>
                  <input className="field" placeholder="TechCorp S.A.S." {...createForm.register('organizationName',{required:'Requerido'})} />
                  {createForm.formState.errors.organizationName && <p style={S.err}>{createForm.formState.errors.organizationName.message}</p>}
                </div>
                <div style={S.row}>
                  <label style={S.label}>Correo electrónico</label>
                  <input className="field" type="email" placeholder="admin@empresa.com"
                    {...createForm.register('email',{required:'Requerido',pattern:{value:/^\S+@\S+$/,message:'Email inválido'}})} />
                  {createForm.formState.errors.email && <p style={S.err}>{createForm.formState.errors.email.message}</p>}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:22 }}>
                  <div>
                    <label style={S.label}>Contraseña</label>
                    <div style={{ position:'relative' }}>
                      <input className="field" type={showPass?'text':'password'} placeholder="Mín. 8" style={{ paddingRight:36 }}
                        {...createForm.register('password',{required:'Requerido',minLength:{value:8,message:'Mín. 8'}})} />
                      <button type="button" onClick={()=>setShowPass(v=>!v)} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text3)' }}>
                        <Eye off={showPass}/>
                      </button>
                    </div>
                    {createForm.formState.errors.password && <p style={S.err}>{createForm.formState.errors.password.message}</p>}
                  </div>
                  <div>
                    <label style={S.label}>Confirmar</label>
                    <input className="field" type="password" placeholder="Repite"
                      {...createForm.register('confirmPassword',{required:'Requerido',validate:v=>v===pass||'No coinciden'})} />
                    {createForm.formState.errors.confirmPassword && <p style={S.err}>{createForm.formState.errors.confirmPassword.message}</p>}
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn btn-go" style={{ width:'100%', justifyContent:'center', padding:13, fontSize:13, letterSpacing:'0.04em' }}>
                  {loading ? 'Creando...' : 'CREAR ORGANIZACIÓN →'}
                </button>
              </form>
            </>
          ) : (
            /* ── JOIN WITH CODE FORM ── */
            <>
              <p style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--text3)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:8 }}>// Unirse a organización</p>
              <h2 style={{ fontFamily:'"Bebas Neue"', fontSize:34, color:'var(--text)', letterSpacing:'0.04em', lineHeight:0.95, marginBottom:28 }}>Ingresar con código</h2>

              <form onSubmit={joinForm.handleSubmit(onJoinSubmit)}>
                {/* Invite code field — big and prominent */}
                <div style={{ marginBottom:16 }}>
                  <label style={S.label}>Código de invitación</label>
                  <input className="field" placeholder="XKQT7BPM"
                    style={{ fontFamily:'"Bebas Neue"', fontSize:28, letterSpacing:'0.2em', textAlign:'center', textTransform:'uppercase', padding:'14px' }}
                    {...joinForm.register('inviteCode',{required:'Requerido',minLength:{value:8,message:'8 caracteres'},maxLength:{value:8,message:'8 caracteres'}})}
                    onChange={e => {
                      const v = e.target.value.replace(/\s/g,'').toUpperCase().slice(0,8);
                      joinForm.setValue('inviteCode', v, { shouldValidate:true });
                    }}
                  />
                  {joinForm.formState.errors.inviteCode && <p style={S.err}>{joinForm.formState.errors.inviteCode.message}</p>}

                  {/* Code validation feedback */}
                  {checkingCode && (
                    <p style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--text3)', marginTop:6 }}>Verificando código...</p>
                  )}
                  {inviteInfo && (
                    <div style={{ marginTop:8, padding:'10px 14px', borderRadius:8, background:'var(--safe-dim)', border:'1px solid rgba(0,200,122,0.2)' }}>
                      <p style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--safe)' }}>
                        ✓ Organización: <strong>{inviteInfo.organizationName}</strong> · {inviteInfo.memberCount} miembro(s)
                      </p>
                    </div>
                  )}
                  {watchedCode?.length === 8 && !inviteInfo && !checkingCode && (
                    <div style={{ marginTop:8, padding:'10px 14px', borderRadius:8, background:'var(--danger-dim)', border:'1px solid rgba(255,64,64,0.2)' }}>
                      <p style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--danger)' }}>
                        ✗ Código inválido. Verifica con tu administrador.
                      </p>
                    </div>
                  )}
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:13 }}>
                  <div>
                    <label style={S.label}>Nombre</label>
                    <input className="field" placeholder="Carlos" {...joinForm.register('firstName',{required:'Requerido'})} />
                    {joinForm.formState.errors.firstName && <p style={S.err}>{joinForm.formState.errors.firstName.message}</p>}
                  </div>
                  <div>
                    <label style={S.label}>Apellido</label>
                    <input className="field" placeholder="Mendoza" {...joinForm.register('lastName',{required:'Requerido'})} />
                    {joinForm.formState.errors.lastName && <p style={S.err}>{joinForm.formState.errors.lastName.message}</p>}
                  </div>
                </div>
                <div style={S.row}>
                  <label style={S.label}>Correo electrónico</label>
                  <input className="field" type="email" placeholder="carlos@empresa.com"
                    {...joinForm.register('email',{required:'Requerido',pattern:{value:/^\S+@\S+$/,message:'Email inválido'}})} />
                  {joinForm.formState.errors.email && <p style={S.err}>{joinForm.formState.errors.email.message}</p>}
                </div>
                <div style={S.row}>
                  <label style={S.label}>Contraseña</label>
                  <div style={{ position:'relative' }}>
                    <input className="field" type={showPass?'text':'password'} placeholder="Mín. 8 caracteres" style={{ paddingRight:36 }}
                      {...joinForm.register('password',{required:'Requerido',minLength:{value:8,message:'Mín. 8 chars'}})} />
                    <button type="button" onClick={()=>setShowPass(v=>!v)} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text3)' }}>
                      <Eye off={showPass}/>
                    </button>
                  </div>
                  {joinForm.formState.errors.password && <p style={S.err}>{joinForm.formState.errors.password.message}</p>}
                </div>

                <button type="submit" disabled={joinLoading || !inviteInfo} className="btn btn-go"
                  style={{ width:'100%', justifyContent:'center', padding:13, fontSize:13, letterSpacing:'0.04em', marginTop:8,
                    opacity: (!inviteInfo) ? 0.4 : 1 }}>
                  {joinLoading ? 'Uniéndome...' : 'UNIRME A LA ORGANIZACIÓN →'}
                </button>
              </form>
            </>
          )}

          <div style={{ marginTop:20, paddingTop:16, borderTop:'1px solid var(--wire)', display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--text3)' }}>¿Ya tienes cuenta?</span>
            <Link to="/login" style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--go)', textDecoration:'none', letterSpacing:'0.06em' }}>
              INGRESAR →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
