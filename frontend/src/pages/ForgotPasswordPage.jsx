import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';

export default function ForgotPasswordPage() {
  const [sent, setSent]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo]   = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async ({ email }) => {
    setLoading(true);
    try {
      await authAPI.forgotPassword(email);
      setSentTo(email);
      setSent(true);
    } catch {
      toast.error('Error al enviar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--ink)' }}>

      {/* Left branding */}
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
            Recupera<br/><span style={{ color:'var(--go)' }}>tu acceso.</span>
          </h1>
          <p style={{ fontFamily:'"Instrument Sans"', fontSize:13, color:'var(--text2)', lineHeight:1.7, maxWidth:320 }}>
            Te enviaremos un enlace seguro a tu correo. El enlace es válido por <strong style={{ color:'var(--text)' }}>1 hora</strong>.
          </p>
          <div style={{ marginTop:32, display:'flex', flexDirection:'column', gap:10 }}>
            {[
              { n:'01', t:'Ingresa tu correo registrado en SUGA' },
              { n:'02', t:'Revisa tu bandeja de entrada (y la carpeta spam)' },
              { n:'03', t:'Haz clic en el enlace del correo para cambiar tu contraseña' },
            ].map(({ n, t }) => (
              <div key={n} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                <span style={{ fontFamily:'"Bebas Neue"', fontSize:18, color:'var(--go)', flexShrink:0, lineHeight:1.2 }}>{n}</span>
                <span style={{ fontFamily:'"Instrument Sans"', fontSize:12, color:'var(--text2)', lineHeight:1.5 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:48, background:'var(--ink)' }}>
        <div style={{ width:'100%', maxWidth:340 }} className="anim-up">

          {!sent ? (
            <>
              <p style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--text3)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:8 }}>
                // Recuperar contraseña
              </p>
              <h2 style={{ fontFamily:'"Bebas Neue"', fontSize:34, color:'var(--text)', letterSpacing:'0.04em', lineHeight:0.95, marginBottom:28 }}>
                Restablecer acceso
              </h2>
              <form onSubmit={handleSubmit(onSubmit)}>
                <div style={{ marginBottom:20 }}>
                  <label className="field-label">Correo electrónico registrado</label>
                  <input
                    className="field"
                    type="email"
                    placeholder="usuario@empresa.com"
                    autoFocus
                    {...register('email', {
                      required: 'El correo es requerido',
                      pattern: { value:/^\S+@\S+$/, message:'Email inválido' },
                    })}
                  />
                  {errors.email && (
                    <p style={{ color:'var(--danger)', fontSize:10, marginTop:4, fontFamily:'"DM Mono"' }}>
                      {errors.email.message}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-go"
                  style={{ width:'100%', justifyContent:'center', padding:13, fontSize:13, letterSpacing:'0.04em' }}
                >
                  {loading
                    ? <><span style={{ display:'inline-block', width:12, height:12, border:'2px solid var(--ink)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin-go 0.6s linear infinite', marginRight:8, verticalAlign:'middle' }} />ENVIANDO...</>
                    : 'ENVIAR ENLACE →'
                  }
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{ textAlign:'center', marginBottom:28 }}>
                <div style={{ width:56, height:56, borderRadius:12, background:'var(--safe-dim)', border:'1px solid rgba(0,200,122,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--safe)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <p style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--safe)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:8 }}>
                  // Correo enviado
                </p>
                <h2 style={{ fontFamily:'"Bebas Neue"', fontSize:30, color:'var(--text)', letterSpacing:'0.04em', marginBottom:16 }}>
                  Revisa tu bandeja
                </h2>
              </div>

              {/* Steps */}
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
                <div style={{ padding:'12px 14px', borderRadius:8, background:'var(--ink3)', border:'1px solid var(--wire)' }}>
                  <p style={{ fontFamily:'"DM Mono"', fontSize:9, color:'var(--text3)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:5 }}>CORREO ENVIADO A</p>
                  <p style={{ fontFamily:'"Instrument Sans"', fontSize:13, color:'var(--go)', fontWeight:600 }}>{sentTo}</p>
                </div>
                <div style={{ padding:'12px 14px', borderRadius:8, background:'var(--ink3)', border:'1px solid var(--wire)' }}>
                  <p style={{ fontFamily:'"DM Mono"', fontSize:9, color:'var(--text3)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:5 }}>PRÓXIMO PASO</p>
                  <p style={{ fontFamily:'"Instrument Sans"', fontSize:12, color:'var(--text2)', lineHeight:1.6 }}>
                    Abre el correo y haz clic en el botón <strong>"Restablecer contraseña"</strong>. El enlace expira en 1 hora.
                  </p>
                </div>
                <div style={{ padding:'12px 14px', borderRadius:8, background:'rgba(255,183,71,0.06)', border:'1px solid rgba(255,183,71,0.15)' }}>
                  <p style={{ fontFamily:'"Instrument Sans"', fontSize:12, color:'var(--amber)', lineHeight:1.6, margin:0 }}>
                    ⚠ Si no ves el correo en 2 minutos, revisa la carpeta de <strong>spam o correo no deseado</strong>.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSent(false)}
                className="btn btn-ghost"
                style={{ width:'100%', justifyContent:'center', padding:'11px', fontSize:12 }}
              >
                Intentar con otro correo
              </button>
            </>
          )}

          <div style={{ marginTop:24, paddingTop:20, borderTop:'1px solid var(--wire)', textAlign:'center' }}>
            <Link to="/login" style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--text3)', textDecoration:'none', letterSpacing:'0.06em' }}
              onMouseEnter={e => e.currentTarget.style.color='var(--go)'}
              onMouseLeave={e => e.currentTarget.style.color='var(--text3)'}>
              ← VOLVER AL LOGIN
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
