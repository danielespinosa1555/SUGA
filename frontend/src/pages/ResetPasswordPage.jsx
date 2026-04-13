import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');

  // States
  const [checking, setChecking]   = useState(true);   // validating token on load
  const [tokenOk, setTokenOk]     = useState(false);  // token is valid
  const [tokenError, setTokenError] = useState('');   // error msg if invalid
  const [userName, setUserName]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [showPass, setShowPass]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm();

  // ── Validate token on page load ──────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setTokenError('No se encontró el token. Usa el enlace del correo completo.');
      setChecking(false);
      return;
    }
    authAPI.validateResetToken(token)
      .then(res => {
        setTokenOk(true);
        setUserName(res.data.name);
        setChecking(false);
      })
      .catch(err => {
        const msg = err.response?.data?.error || 'Enlace inválido o expirado';
        setTokenError(msg);
        setChecking(false);
      });
  }, [token]);

  // ── Submit new password ──────────────────────────────────────────────────
  const onSubmit = async ({ password }) => {
    setLoading(true);
    try {
      await authAPI.resetPassword({ token, password });
      setDone(true);
      toast.success('¡Contraseña actualizada! Redirigiendo...');
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al cambiar la contraseña';
      toast.error(msg);
      // If token expired mid-session, show the error state
      if (err.response?.status === 400) setTokenError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Shared styles ─────────────────────────────────────────────────────────
  const EyeIcon = ({ off }) => off
    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10 10 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9 9 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
    : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--ink)' }}>

      {/* ── Left branding panel ── */}
      <div style={{ flex:'0 0 44%', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', justifyContent:'center', padding:48, background:'var(--ink2)', borderRight:'1px solid var(--wire)' }}>
        <div className="grid-lines" style={{ position:'absolute', inset:0 }} />
        <div style={{ position:'absolute', right:0, top:0, bottom:0, width:3, background:'var(--go)' }} />
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:48 }}>
            <div style={{ width:40, height:40, background:'var(--go)', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontFamily:'"Bebas Neue"', fontSize:24, color:'var(--ink)', lineHeight:1 }}>S</span>
            </div>
            <span style={{ fontFamily:'"Bebas Neue"', fontSize:22, letterSpacing:'0.12em', color:'var(--text)' }}>SUGA</span>
          </div>
          <h1 style={{ fontFamily:'"Bebas Neue"', fontSize:64, lineHeight:0.9, color:'var(--text)', letterSpacing:'0.02em', marginBottom:20 }}>
            Nueva<br/><span style={{ color:'var(--go)' }}>contraseña.</span>
          </h1>
          <p style={{ fontFamily:'"Instrument Sans"', fontSize:13, color:'var(--text2)', lineHeight:1.7, maxWidth:320 }}>
            Elige una contraseña segura de mínimo 8 caracteres. Después podrás iniciar sesión normalmente.
          </p>
          <div style={{ marginTop:32, padding:'14px 18px', borderRadius:8, background:'var(--ink3)', border:'1px solid var(--wire)' }}>
            <p style={{ fontFamily:'"DM Mono"', fontSize:9, color:'var(--text3)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6 }}>SEGURIDAD</p>
            <p style={{ fontFamily:'"Instrument Sans"', fontSize:12, color:'var(--text2)', lineHeight:1.6, margin:0 }}>
              Este enlace es de un solo uso y expira en 1 hora. Nunca compartas esta URL con nadie.
            </p>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:48, background:'var(--ink)' }}>
        <div style={{ width:'100%', maxWidth:360 }} className="anim-up">

          {/* ── CHECKING ── */}
          {checking && (
            <div style={{ textAlign:'center' }}>
              <div style={{ width:48, height:48, border:'3px solid var(--go)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin-go 0.8s linear infinite', margin:'0 auto 20px' }} />
              <p style={{ fontFamily:'"DM Mono"', fontSize:11, color:'var(--text3)', letterSpacing:'0.1em' }}>VERIFICANDO ENLACE...</p>
            </div>
          )}

          {/* ── TOKEN INVALID ── */}
          {!checking && !tokenOk && (
            <div style={{ textAlign:'center' }}>
              <div style={{ width:56, height:56, borderRadius:12, background:'var(--danger-dim)', border:'1px solid rgba(255,64,64,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </div>
              <p style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--text3)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:8 }}>// Enlace inválido</p>
              <h2 style={{ fontFamily:'"Bebas Neue"', fontSize:30, color:'var(--danger)', letterSpacing:'0.04em', marginBottom:12 }}>
                No se puede continuar
              </h2>
              <p style={{ fontFamily:'"Instrument Sans"', fontSize:13, color:'var(--text2)', lineHeight:1.7, marginBottom:24 }}>
                {tokenError}
              </p>
              <Link to="/forgot-password" className="btn btn-go" style={{ display:'inline-flex', justifyContent:'center', padding:'12px 28px', fontSize:13, letterSpacing:'0.04em', textDecoration:'none' }}>
                SOLICITAR NUEVO ENLACE →
              </Link>
            </div>
          )}

          {/* ── DONE ── */}
          {!checking && tokenOk && done && (
            <div style={{ textAlign:'center' }}>
              <div style={{ width:56, height:56, borderRadius:12, background:'var(--safe-dim)', border:'1px solid rgba(0,200,122,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--safe)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--safe)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:8 }}>// Listo</p>
              <h2 style={{ fontFamily:'"Bebas Neue"', fontSize:30, color:'var(--text)', letterSpacing:'0.04em', marginBottom:12 }}>
                ¡Contraseña cambiada!
              </h2>
              <p style={{ fontFamily:'"Instrument Sans"', fontSize:13, color:'var(--text2)', lineHeight:1.7, marginBottom:20 }}>
                Tu contraseña ha sido actualizada correctamente. Redirigiendo al inicio de sesión...
              </p>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--safe)', animation:'blink 1s ease-in-out infinite' }} />
                <span style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--text3)' }}>Redirigiendo...</span>
              </div>
              <Link to="/login" style={{ display:'block', marginTop:16, fontFamily:'"DM Mono"', fontSize:10, color:'var(--go)', textDecoration:'none', letterSpacing:'0.06em' }}>
                IR AL LOGIN →
              </Link>
            </div>
          )}

          {/* ── FORM ── */}
          {!checking && tokenOk && !done && (
            <>
              <p style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--text3)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:8 }}>
                // Cambio de contraseña
              </p>
              <h2 style={{ fontFamily:'"Bebas Neue"', fontSize:34, color:'var(--text)', letterSpacing:'0.04em', lineHeight:0.95, marginBottom:6 }}>
                Hola, {userName?.split(' ')[0] || 'usuario'}
              </h2>
              <p style={{ fontFamily:'"Instrument Sans"', fontSize:12, color:'var(--text3)', marginBottom:28 }}>
                Escribe tu nueva contraseña a continuación.
              </p>

              <form onSubmit={handleSubmit(onSubmit)}>
                {/* New password */}
                <div style={{ marginBottom:14 }}>
                  <label className="field-label">Nueva contraseña</label>
                  <div style={{ position:'relative' }}>
                    <input
                      className="field"
                      type={showPass ? 'text' : 'password'}
                      placeholder="Mínimo 8 caracteres"
                      style={{ paddingRight:40 }}
                      {...register('password', {
                        required: 'La contraseña es requerida',
                        minLength: { value:8, message:'Mínimo 8 caracteres' },
                      })}
                    />
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text3)', padding:2 }}>
                      <EyeIcon off={showPass} />
                    </button>
                  </div>
                  {errors.password && (
                    <p style={{ color:'var(--danger)', fontSize:10, marginTop:4, fontFamily:'"DM Mono"' }}>
                      {errors.password.message}
                    </p>
                  )}
                </div>

                {/* Confirm password */}
                <div style={{ marginBottom:28 }}>
                  <label className="field-label">Confirmar contraseña</label>
                  <div style={{ position:'relative' }}>
                    <input
                      className="field"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Repite la contraseña"
                      style={{ paddingRight:40 }}
                      {...register('confirm', {
                        required: 'Confirma tu contraseña',
                        validate: v => v === watch('password') || 'Las contraseñas no coinciden',
                      })}
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text3)', padding:2 }}>
                      <EyeIcon off={showConfirm} />
                    </button>
                  </div>
                  {errors.confirm && (
                    <p style={{ color:'var(--danger)', fontSize:10, marginTop:4, fontFamily:'"DM Mono"' }}>
                      {errors.confirm.message}
                    </p>
                  )}
                </div>

                {/* Password strength hint */}
                {watch('password')?.length > 0 && (
                  <div style={{ marginBottom:16, padding:'10px 14px', borderRadius:6, background:'var(--ink3)', border:'1px solid var(--wire)' }}>
                    {[
                      { ok: watch('password')?.length >= 8,   label: 'Al menos 8 caracteres' },
                      { ok: /[A-Z]/.test(watch('password')),  label: 'Una mayúscula' },
                      { ok: /[0-9]/.test(watch('password')),  label: 'Un número' },
                    ].map((c, i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:6, marginBottom: i<2?4:0 }}>
                        <span style={{ color: c.ok ? 'var(--safe)' : 'var(--text4)', fontSize:11 }}>{c.ok ? '✓' : '○'}</span>
                        <span style={{ fontFamily:'"DM Mono"', fontSize:9, color: c.ok ? 'var(--safe)' : 'var(--text4)', letterSpacing:'0.06em' }}>
                          {c.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-go"
                  style={{ width:'100%', justifyContent:'center', padding:13, fontSize:13, letterSpacing:'0.04em' }}
                >
                  {loading
                    ? <><span style={{ display:'inline-block', width:12, height:12, border:'2px solid var(--ink)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin-go 0.6s linear infinite', marginRight:8, verticalAlign:'middle' }} />GUARDANDO...</>
                    : 'CAMBIAR CONTRASEÑA →'
                  }
                </button>
              </form>
            </>
          )}

          {/* Back to login */}
          {!checking && (
            <div style={{ marginTop:28, paddingTop:20, borderTop:'1px solid var(--wire)', textAlign:'center' }}>
              <Link to="/login" style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--text3)', textDecoration:'none', letterSpacing:'0.06em' }}
                onMouseEnter={e => e.currentTarget.style.color='var(--go)'}
                onMouseLeave={e => e.currentTarget.style.color='var(--text3)'}>
                ← VOLVER AL LOGIN
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
