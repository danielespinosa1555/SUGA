import React from 'react';

/* ── PageHeader ──────────────────────────────────────────────────────────── */
export function PageHeader({ title, subtitle, children }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:28, gap:16 }}>
      <div>
        {subtitle && (
          <p style={{ fontFamily:'"DM Mono",monospace', fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--text3)', marginBottom:6 }}>
            {subtitle}
          </p>
        )}
        <h1 style={{ fontFamily:'"Bebas Neue",sans-serif', fontSize:38, letterSpacing:'0.04em', color:'var(--text)', lineHeight:0.95 }}>
          {title}
        </h1>
      </div>
      {children && <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, paddingTop:4 }}>{children}</div>}
    </div>
  );
}

/* ── StatCard ────────────────────────────────────────────────────────────── */
export function StatCard({ label, value, color='green', sub, sparkData }) {
  const colorMap = { green:'var(--go)', red:'var(--danger)', amber:'var(--warn)', blue:'var(--info)' };
  const c = colorMap[color] || 'var(--go)';
  return (
    <div style={{ background:'var(--ink2)', border:'1px solid var(--wire)', borderRadius:10, padding:18, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,${c},transparent)` }} />
      <p style={{ fontFamily:'"DM Mono",monospace', fontSize:9, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text3)', marginBottom:10 }}>{label}</p>
      <p style={{ fontFamily:'"Bebas Neue",sans-serif', fontSize:42, lineHeight:0.9, color:c, letterSpacing:'0.03em' }}>{value}</p>
      {sub && <p style={{ fontFamily:'"DM Mono",monospace', fontSize:9, color:'var(--text3)', marginTop:8 }}>{sub}</p>}
      {sparkData && (
        <div style={{ display:'flex', alignItems:'flex-end', gap:2, marginTop:12, height:24 }}>
          {sparkData.map((v,i) => (
            <div key={i} style={{ flex:1, borderRadius:2, background:c, opacity:0.3+(i/sparkData.length)*0.7,
              height:`${Math.max(4,(v/Math.max(...sparkData))*24)}px` }} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Badge ───────────────────────────────────────────────────────────────── */
export function Badge({ status }) {
  const map = {
    present:   ['tag tag-safe',    'Presente'],
    absent:    ['tag tag-danger',  'Ausente'],
    justified: ['tag',             'Justificado'],
    late:      ['tag tag-warn',    'Tardanza'],
    pending:   ['tag tag-warn',    'Pendiente'],
    review:    ['tag tag-info',    'En revisión'],
    approved:  ['tag tag-safe',    'Aprobado'],
    rejected:  ['tag tag-danger',  'Rechazado'],
    admin:     ['tag tag-go',      'Admin'],
    member:    ['tag tag-neutral', 'Miembro'],
  };
  const [cls, label] = map[status] || ['tag tag-neutral', status];
  return <span className={cls}>{label}</span>;
}

/* ── ProgressBar ─────────────────────────────────────────────────────────── */
export function ProgressBar({ value }) {
  const cls = value >= 85 ? 'bar-safe' : value >= 75 ? 'bar-warn' : 'bar-danger';
  const color = value >= 85 ? 'var(--go)' : value >= 75 ? 'var(--warn)' : 'var(--danger)';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div className="bar-track" style={{ flex:1 }}>
        <div className={`bar-fill ${cls}`} style={{ width:`${Math.min(100,value||0)}%` }} />
      </div>
      <span style={{ fontFamily:'"DM Mono",monospace', fontSize:10, color, minWidth:32, textAlign:'right' }}>
        {(value||0).toFixed(1)}%
      </span>
    </div>
  );
}

/* ── Avatar ──────────────────────────────────────────────────────────────── */
export function Avatar({ name, size='md' }) {
  const initials = name ? name.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase() : '?';
  const sz = { sm:28, md:34, lg:42 }[size] || 34;
  const fs = { sm:11, md:13, lg:16 }[size] || 13;
  return (
    <div className="avatar" style={{ width:sz, height:sz, fontSize:fs }}>
      {initials}
    </div>
  );
}

/* ── Modal ───────────────────────────────────────────────────────────────── */
// title can be a string OR a React node (JSX)
export function Modal({ open, onClose, title, children, footer, wide=false, noPadding=false }) {
  if (!open) return null;
  const isTitleJSX = title && typeof title !== 'string';
  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:20, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="anim-up" style={{
        background:'var(--ink2)',
        border:'1px solid var(--wire2)',
        borderRadius:12,
        width:'100%', maxWidth: wide ? 780 : 500,
        maxHeight:'90vh',
        display:'flex', flexDirection:'column',
        overflow:'hidden',
      }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:'1px solid var(--wire)', gap:12, flexShrink:0 }}>
          {isTitleJSX
            ? <div style={{ flex:1, minWidth:0 }}>{title}</div>
            : <h2 style={{ fontFamily:'"Bebas Neue",sans-serif', fontSize:22, letterSpacing:'0.04em', color:'var(--text)', lineHeight:1, margin:0 }}>{title}</h2>
          }
          <button
            onClick={onClose}
            style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:18, lineHeight:1, padding:'2px 6px', flexShrink:0, transition:'color 0.1s', borderRadius:4 }}
            onMouseEnter={e=>e.currentTarget.style.color='var(--text)'}
            onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}
          >✕</button>
        </div>
        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding: noPadding ? 0 : '20px' }}>{children}</div>
        {/* Footer */}
        {footer && (
          <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'14px 20px', borderTop:'1px solid var(--wire)', flexShrink:0 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Empty ───────────────────────────────────────────────────────────────── */
export function Empty({ icon='◎', title, subtitle }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'48px 24px', textAlign:'center', gap:10 }}>
      <div style={{ fontFamily:'"Bebas Neue",sans-serif', fontSize:48, color:'var(--text4)', lineHeight:1 }}>{icon}</div>
      <p style={{ fontFamily:'"Bebas Neue",sans-serif', fontSize:20, color:'var(--text3)', letterSpacing:'0.04em' }}>{title}</p>
      {subtitle && <p style={{ fontFamily:'"DM Mono",monospace', fontSize:11, color:'var(--text4)' }}>{subtitle}</p>}
    </div>
  );
}

/* ── Spinner ─────────────────────────────────────────────────────────────── */
export function Spinner({ size='md' }) {
  const s = size==='sm' ? 16 : 32;
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding: size==='sm' ? 0 : 40 }}>
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className="animate-spin">
        <circle cx="12" cy="12" r="10" stroke="var(--ink5)" strokeWidth="3" />
        <path d="M12 2 A10 10 0 0 1 22 12" stroke="var(--go)" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/* ── Alert ───────────────────────────────────────────────────────────────── */
export function Alert({ type='info', children }) {
  const cls = { info:'alert-info', warning:'alert-warn', danger:'alert-danger', success:'alert-success' }[type] || 'alert-info';
  return <div className={`alert ${cls}`}>{children}</div>;
}

/* ── ChatModal ───────────────────────────────────────────────────────────── */
// Standalone chat modal that manages its own state cleanly
export function ChatModal({ open, onClose, justificationId, memberName, sessionTitle, status, reason, currentUserId }) {
  const [messages, setMessages]   = React.useState([]);
  const [loading, setLoading]     = React.useState(true);
  const [msg, setMsg]             = React.useState('');
  const [sending, setSending]     = React.useState(false);
  const bottomRef                 = React.useRef();
  const inputRef                  = React.useRef();
  const pollRef                   = React.useRef();

  const loadMessages = React.useCallback(async () => {
    if (!justificationId) return;
    try {
      const token = localStorage.getItem('suga_token');
      const res = await fetch(`/api/justifications/${justificationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (_) {}
    finally { setLoading(false); }
  }, [justificationId]);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    setMessages([]);
    setMsg('');
    loadMessages();
    // Poll every 5s
    pollRef.current = setInterval(loadMessages, 5000);
    return () => clearInterval(pollRef.current);
  }, [open, justificationId, loadMessages]);

  React.useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior:'smooth' });
    }
  }, [messages.length]);

  const sendMessage = async () => {
    const text = msg.trim();
    if (!text || sending) return;
    setSending(true);
    const optimistic = {
      id: `temp-${Date.now()}`,
      message: text,
      sender_id: currentUserId,
      sender_name: 'Tú',
      sender_role: 'optimistic',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setMsg('');
    setTimeout(() => inputRef.current?.focus(), 50);
    try {
      const token = localStorage.getItem('suga_token');
      const res = await fetch(`/api/justifications/${justificationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) {
        await loadMessages(); // refresh to get real message with correct data
      } else {
        const err = await res.json();
        setMessages(prev => prev.filter(m => m.id !== optimistic.id));
        alert(err.error || 'Error al enviar');
      }
    } catch (_) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  const fmtTime = (d) => {
    const date = new Date(d);
    const now  = new Date();
    const isToday = date.toDateString() === now.toDateString();
    return isToday
      ? date.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })
      : date.toLocaleDateString('es-CO', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
  };

  if (!open) return null;

  const badgeMap = {
    pending:  { bg:'rgba(255,183,71,0.15)', color:'var(--warn)', label:'Pendiente' },
    review:   { bg:'rgba(100,160,255,0.15)', color:'var(--info)', label:'En revisión' },
    approved: { bg:'rgba(0,200,122,0.15)', color:'var(--safe)', label:'Aprobada' },
    rejected: { bg:'rgba(255,64,64,0.15)', color:'var(--danger)', label:'Rechazada' },
  };
  const badge = badgeMap[status] || badgeMap.pending;

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:20, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="anim-up" style={{
        background:'var(--ink2)', border:'1px solid var(--wire2)', borderRadius:14,
        width:'100%', maxWidth:520, height:560,
        display:'flex', flexDirection:'column', overflow:'hidden',
      }}>
        {/* ── Header ── */}
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--wire)', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <div style={{
            width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,var(--accent),var(--purple))',
            display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:13, fontWeight:700, flexShrink:0,
          }}>
            {memberName?.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase()}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              💬 {memberName}
            </div>
            <div style={{ fontSize:11, color:'var(--text3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {sessionTitle}
            </div>
          </div>
          <span style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:badge.bg, color:badge.color, fontWeight:600, flexShrink:0 }}>
            {badge.label}
          </span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:16, padding:'2px 4px', flexShrink:0 }}>✕</button>
        </div>

        {/* ── Reason context ── */}
        <div style={{ padding:'10px 18px', background:'var(--ink3)', borderBottom:'1px solid var(--wire)', flexShrink:0 }}>
          <span style={{ fontSize:10, color:'var(--text3)', fontFamily:'"DM Mono"', letterSpacing:'0.06em', textTransform:'uppercase' }}>Motivo: </span>
          <span style={{ fontSize:12, color:'var(--text2)' }}>{reason}</span>
        </div>

        {/* ── Messages ── */}
        <div style={{ flex:1, overflowY:'auto', padding:'14px 18px', display:'flex', flexDirection:'column', gap:10 }}>
          {loading && (
            <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text3)' }}>
              <div style={{ width:24, height:24, border:'2px solid var(--go)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin-go 0.8s linear infinite', margin:'0 auto 10px' }} />
              <div style={{ fontSize:12 }}>Cargando mensajes...</div>
            </div>
          )}
          {!loading && messages.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text3)' }}>
              <div style={{ fontSize:36, marginBottom:10 }}>💬</div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text2)', marginBottom:4 }}>Sin mensajes aún</div>
              <div style={{ fontSize:11 }}>Inicia la conversación sobre esta justificación</div>
            </div>
          )}
          {messages.map(m => {
            const isMe = m.sender_id === currentUserId;
            const isTemp = String(m.id).startsWith('temp-');
            return (
              <div key={m.id} style={{ display:'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', gap:8 }}>
                {!isMe && (
                  <div style={{ width:26, height:26, borderRadius:'50%', background:'var(--ink4)', border:'1px solid var(--wire)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'var(--text3)', flexShrink:0, alignSelf:'flex-end' }}>
                    {m.sender_name?.charAt(0) || '?'}
                  </div>
                )}
                <div style={{ maxWidth:'72%' }}>
                  {!isMe && (
                    <div style={{ fontSize:9, color:'var(--text3)', marginBottom:3, fontFamily:'"DM Mono"', letterSpacing:'0.04em' }}>
                      {m.sender_role === 'admin' ? '👑 Admin' : '👤 Miembro'}
                    </div>
                  )}
                  <div style={{
                    padding:'9px 13px',
                    borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: isMe ? 'var(--accent)' : 'var(--ink3)',
                    color: isMe ? 'white' : 'var(--text)',
                    fontSize:13, lineHeight:1.5,
                    border: isMe ? 'none' : '1px solid var(--wire)',
                    opacity: isTemp ? 0.6 : 1,
                    transition: 'opacity 0.2s',
                  }}>
                    {m.message}
                  </div>
                  <div style={{ fontSize:9, color:'var(--text4)', marginTop:3, textAlign: isMe ? 'right' : 'left', fontFamily:'"DM Mono"' }}>
                    {isTemp ? 'Enviando...' : fmtTime(m.created_at)}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} style={{ height:1 }} />
        </div>

        {/* ── Input ── */}
        <div style={{ padding:'12px 18px', borderTop:'1px solid var(--wire)', display:'flex', gap:10, flexShrink:0, background:'var(--ink2)' }}>
          <input
            ref={inputRef}
            style={{
              flex:1, background:'var(--ink3)', border:'1px solid var(--wire2)', borderRadius:8,
              padding:'10px 14px', fontSize:13, color:'var(--text)', outline:'none',
              fontFamily:'"Instrument Sans",sans-serif',
            }}
            placeholder="Escribe un mensaje..."
            value={msg}
            onChange={e => setMsg(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--wire2)'}
            autoFocus
          />
          <button
            onClick={sendMessage}
            disabled={!msg.trim() || sending}
            style={{
              background: msg.trim() ? 'var(--accent)' : 'var(--ink4)',
              border: 'none', borderRadius:8, padding:'10px 16px',
              color: msg.trim() ? 'white' : 'var(--text4)',
              fontSize:16, cursor: msg.trim() ? 'pointer' : 'not-allowed',
              transition:'all 0.15s', flexShrink:0,
            }}
          >
            {sending ? '⋯' : '→'}
          </button>
        </div>
      </div>
    </div>
  );
}
