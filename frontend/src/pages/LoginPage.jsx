import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import useAuthStore from '../context/authStore';
import { authAPI } from '../services/api';

export default function LoginPage() {
  const { login, loading } = useAuthStore();
  const navigate = useNavigate();
  const [step, setStep] = useState('login'); // login | 2fa
  const [showPass, setShowPass] = useState(false);
  const { register, handleSubmit, getValues, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    const result = await login(data);
    if (result?.requires2FA) { setStep('2fa'); toast('Ingresa tu código 2FA', { icon:'🔐' }); }
    else if (result?.success) {
      const u = JSON.parse(localStorage.getItem('suga_user'));
      navigate(u?.role === 'admin' ? '/dashboard' : '/my-attendance');
    } else if (result?.error) toast.error(result.error);
  };

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--ink)' }}>

      {/* ── LEFT — brand panel ── */}
      <div style={{
        flex:'0 0 52%',
        position:'relative',
        overflow:'hidden',
        display:'flex',
        flexDirection:'column',
        justifyContent:'space-between',
        padding:'48px',
        background:'var(--ink2)',
        borderRight:'1px solid var(--wire)',
      }}>
        {/* grid lines bg */}
        <div className="grid-lines" style={{ position:'absolute', inset:0 }} />

        {/* horizontal rule lines — decorative */}
        {[20, 38, 56, 74, 90].map(p => (
          <div key={p} style={{ position:'absolute', left:0, right:0, top:`${p}%`, height:'1px', background:'var(--wire)', opacity:0.6 }} />
        ))}

        {/* vertical accent line */}
        <div style={{ position:'absolute', right:0, top:0, bottom:0, width:3, background:'var(--go)' }} />

        {/* Content */}
        <div style={{ position:'relative', zIndex:1 }}>
          {/* Logo row */}
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:40, height:40, background:'var(--go)', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontFamily:'"Bebas Neue"', fontSize:24, color:'var(--ink)', lineHeight:1 }}>S</span>
            </div>
            <div>
              <div style={{ fontFamily:'"Bebas Neue"', fontSize:22, letterSpacing:'0.12em', color:'var(--text)', lineHeight:1 }}>SUGA</div>
              <div style={{ fontFamily:'"DM Mono"', fontSize:9, color:'var(--text3)', letterSpacing:'0.1em', textTransform:'uppercase', marginTop:2 }}>v2.1 · Sistema de Asistencia</div>
            </div>
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:4, background:'var(--go-dim)', border:'1px solid rgba(200,255,0,0.2)' }}>
              <div style={{ width:5, height:5, borderRadius:'50%', background:'var(--go)', animation:'blink 2s ease-in-out infinite' }} />
              <span style={{ fontFamily:'"DM Mono"', fontSize:9, color:'var(--go)', letterSpacing:'0.08em' }}>ONLINE</span>
            </div>
          </div>
        </div>

        {/* Main copy */}
        <div style={{ position:'relative', zIndex:1 }}>
          <p style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--text3)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:16 }}>
            // Inicialización del sistema
          </p>
          <h1 style={{ fontFamily:'"Bebas Neue"', fontSize:82, lineHeight:0.88, color:'var(--text)', letterSpacing:'0.02em', marginBottom:24 }}>
            Control<br/>
            <span style={{ color:'var(--go)' }}>Total</span><br/>
            de Asistencia.
          </h1>
          <p style={{ fontFamily:'"Instrument Sans"', fontSize:14, color:'var(--text2)', lineHeight:1.7, maxWidth:380 }}>
            Registro de sesiones, control de presencia y gestión de justificaciones para cualquier organización.
          </p>
        </div>

        {/* Stats row */}
        <div style={{ position:'relative', zIndex:1, display:'flex', gap:0, borderTop:'1px solid var(--wire)', paddingTop:24 }}>
          {[['99.9%','Uptime'],['AES-256','Cifrado'],['Multi-org','Soportado']].map(([v,l],i) => (
            <div key={i} style={{ flex:1, paddingRight:24 }}>
              <div style={{ fontFamily:'"Bebas Neue"', fontSize:22, color:'var(--text)', letterSpacing:'0.04em' }}>{v}</div>
              <div style={{ fontFamily:'"DM Mono"', fontSize:9, color:'var(--text3)', letterSpacing:'0.08em', textTransform:'uppercase', marginTop:3 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT — form panel ── */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:48, background:'var(--ink)' }}>
        <div style={{ width:'100%', maxWidth:360 }} className="anim-up">

          {step === 'login' ? (<>
            {/* Heading */}
            <div style={{ marginBottom:32 }}>
              <p style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--text3)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:8 }}>
                // Autenticación requerida
              </p>
              <h2 style={{ fontFamily:'"Bebas Neue"', fontSize:34, color:'var(--text)', letterSpacing:'0.04em', lineHeight:0.95 }}>
                Acceder al sistema
              </h2>
            </div>

            {/* Google */}
            <button onClick={() => authAPI.googleLogin()} style={{
              width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:10,
              padding:'11px 16px', borderRadius:8,
              background:'var(--ink3)', border:'1px solid var(--wire2)',
              color:'var(--text2)', fontSize:12, fontFamily:'"Instrument Sans"', fontWeight:500,
              cursor:'pointer', marginBottom:20, transition:'all 0.12s',
            }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--wire3)';e.currentTarget.style.color='var(--text)';}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--wire2)';e.currentTarget.style.color='var(--text2)';}}
            >
              <GoogleIcon /> Continuar con Google
            </button>

            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
              <div style={{ flex:1, height:1, background:'var(--wire)' }} />
              <span style={{ fontFamily:'"DM Mono"', fontSize:9, color:'var(--text3)', letterSpacing:'0.08em' }}>ó CON EMAIL</span>
              <div style={{ flex:1, height:1, background:'var(--wire)' }} />
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
              <div style={{ marginBottom:14 }}>
                <label className="field-label">Correo electrónico</label>
                <input className="field" type="email" placeholder="usuario@empresa.com"
                  {...register('email',{required:'Requerido',pattern:{value:/^\S+@\S+$/,message:'Email inválido'}})} />
                {errors.email && <p style={{color:'var(--danger)',fontSize:10,marginTop:4,fontFamily:'"DM Mono"'}}>{errors.email.message}</p>}
              </div>

              <div style={{ marginBottom:20 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                  <label className="field-label" style={{ margin:0 }}>Contraseña</label>
                  <Link to="/forgot-password" style={{ fontFamily:'"DM Mono"', fontSize:9, color:'var(--go)', textDecoration:'none', letterSpacing:'0.06em' }}>
                    ¿OLVIDASTE?
                  </Link>
                </div>
                <div style={{ position:'relative' }}>
                  <input className="field" type={showPass?'text':'password'} placeholder="••••••••"
                    style={{ paddingRight:40 }}
                    {...register('password',{required:'Requerido',minLength:{value:6,message:'Mín. 6 chars'}})} />
                  <button type="button" onClick={()=>setShowPass(v=>!v)}
                    style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text3)', padding:2 }}>
                    {showPass
                      ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10 10 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9 9 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                  </button>
                </div>
                {errors.password && <p style={{color:'var(--danger)',fontSize:10,marginTop:4,fontFamily:'"DM Mono"'}}>{errors.password.message}</p>}
              </div>

              <button type="submit" disabled={loading} className="btn btn-go" style={{ width:'100%', justifyContent:'center', padding:'13px', fontSize:13, letterSpacing:'0.04em' }}>
                {loading ? 'Verificando...' : 'INICIAR SESIÓN →'}
              </button>
            </form>

            <div style={{ marginTop:24, paddingTop:20, borderTop:'1px solid var(--wire)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--text3)' }}>¿Sin cuenta?</span>
              <Link to="/register" style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--go)', textDecoration:'none', letterSpacing:'0.06em' }}>
                CREAR CUENTA →
              </Link>
            </div>

            {/* Demo hint */}
            <div style={{ marginTop:16, padding:'10px 14px', borderRadius:6, background:'var(--ink3)', border:'1px solid var(--wire)', display:'flex', gap:10, alignItems:'center' }}>
              <span style={{ fontFamily:'"DM Mono"', fontSize:9, color:'var(--text3)' }}>DEMO ▸</span>
              <span style={{ fontFamily:'"DM Mono"', fontSize:9, color:'var(--text2)' }}>admin@suga.app / demo1234</span>
            </div>
          </>) : (
            /* 2FA */
            <form onSubmit={handleSubmit(onSubmit)}>
              <div style={{ marginBottom:28 }}>
                <p style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--text3)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:8 }}>
                  // Verificación adicional
                </p>
                <h2 style={{ fontFamily:'"Bebas Neue"', fontSize:34, color:'var(--text)', letterSpacing:'0.04em', lineHeight:0.95 }}>
                  Código 2FA
                </h2>
              </div>
              <div style={{ marginBottom:20, padding:14, borderRadius:8, background:'var(--ink3)', border:'1px solid var(--wire2)' }}>
                <p style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--text2)', lineHeight:1.6 }}>
                  Abre tu app de autenticación e ingresa el código de 6 dígitos para SUGA.
                </p>
              </div>
              <div style={{ marginBottom:20 }}>
                <label className="field-label">Código TOTP</label>
                <input className="field" type="text" maxLength={6} placeholder="000000"
                  style={{ textAlign:'center', fontSize:22, fontFamily:'"Bebas Neue"', letterSpacing:'0.4em' }}
                  {...register('totpCode',{required:true,minLength:6,maxLength:6})} />
              </div>
              <input type="hidden" {...register('email')} value={getValues('email')} />
              <input type="hidden" {...register('password')} value={getValues('password')} />
              <button type="submit" disabled={loading} className="btn btn-go" style={{ width:'100%', justifyContent:'center', padding:13 }}>
                {loading ? 'Verificando...' : 'CONFIRMAR →'}
              </button>
              <button type="button" onClick={()=>setStep('login')} className="btn btn-ghost" style={{ width:'100%', justifyContent:'center', marginTop:8 }}>
                ← VOLVER
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const GoogleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);
