import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import useAuthStore from '../../context/authStore';
import { notificationsAPI } from '../../services/api';

/* ── tiny SVG icon helper ─────────────────────────────────────────────────── */
const I = ({ path, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {[].concat(path).map((d, i) => <path key={i} d={d} />)}
  </svg>
);

const ICONS = {
  dash:     ['M4 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5z','M14 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5z','M4 14a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5z','M14 13a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-6z'],
  sess:     ['M8 2v4','M16 2v4','M3 10h18','M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z'],
  just:     ['M9 12h6','M9 16h6','M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z','M14 3v5h5'],
  cal:      ['M3 9h18','M8 2v4','M16 2v4','M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'],
  attend:   ['M22 11.08V12a10 10 0 1 1-5.93-9.14','M22 4L12 14.01l-3-3'],
  reports:  ['M18 20V10','M12 20V4','M6 20v-6'],
  chart:    ['M3 3v18h18','M18.7 8l-5.1 5.2-2.8-2.7L7 14.3'],
  users:    ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2','M23 21v-2a4 4 0 0 0-3-3.87','M16 3.13a4 4 0 0 1 0 7.75','M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8'],
  cog:      ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z','M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'],
  myjust:  ['M12 20h9','M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z'],
  exit:    ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4','M16 17l5-5-5-5','M21 12H9'],
  bell:    ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9','M13.73 21a2 2 0 0 1-3.46 0'],
};

const ADMIN_NAV = [
  { to:'/dashboard',         icon:'dash',   label:'Panel' },
  { to:'/sessions',          icon:'sess',   label:'Sesiones' },
  { to:'/justifications',    icon:'just',   label:'Justif.',  badge:true },
  null, // divider
  { to:'/my-attendance',     icon:'attend', label:'Asistencia' },
  { to:'/my-justifications', icon:'myjust', label:'Mis just.' },
  { to:'/calendar',          icon:'cal',    label:'Calendario' },
  null,
  { to:'/reports',           icon:'reports',label:'Reportes' },
  { to:'/analytics',         icon:'chart',  label:'Analítica' },
  { to:'/users',             icon:'users',  label:'Usuarios' },
  { to:'/settings',          icon:'cog',    label:'Config.' },
];

const MEMBER_NAV = [
  { to:'/my-attendance',     icon:'attend', label:'Asistencia' },
  { to:'/my-justifications', icon:'myjust', label:'Justif.' },
  { to:'/calendar',          icon:'cal',    label:'Calendario' },
];

export default function AppLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin  = user?.role === 'admin';
  const nav      = isAdmin ? ADMIN_NAV : MEMBER_NAV;
  const initials = `${user?.firstName?.[0]||''}${user?.lastName?.[0]||''}`.toUpperCase();

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn:  () => notificationsAPI.getAll().then(r => r.data),
    refetchInterval: 30000,
    enabled: !!user,
  });
  const unread = notifData?.notifications?.filter(n => !n.read).length || 0;

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--ink)' }}>

      {/* ── SIDEBAR — vertical icon rail ──────────────────────────────────── */}
      <aside style={{
        width: 68,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'var(--ink2)',
        borderRight: '1px solid var(--wire)',
        padding: '16px 0',
        gap: 0,
        position: 'relative',
        zIndex: 10,
      }}>
        {/* Logo mark */}
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: 'var(--go)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
          cursor: 'pointer',
        }} onClick={() => navigate(isAdmin ? '/dashboard' : '/my-attendance')}>
          <span style={{ fontFamily:'"Bebas Neue"', fontSize: 20, color: 'var(--ink)', letterSpacing: '0.05em', lineHeight:1 }}>S</span>
        </div>

        {/* Nav items */}
        <nav style={{ flex:1, width:'100%', display:'flex', flexDirection:'column', alignItems:'center', gap: 2, padding:'0 7px', overflowY:'auto' }}>
          {nav.map((item, i) =>
            item === null ? (
              <div key={`d${i}`} style={{ width:28, height:1, background:'var(--wire)', margin:'6px 0' }} />
            ) : (
              <NavLink key={item.to} to={item.to} className={({isActive}) => `nav-link${isActive?' active':''}`}
                title={item.label} style={{ position:'relative' }}>
                <I path={ICONS[item.icon]} size={17} />
                <span style={{ fontFamily:'"DM Mono"', fontSize:8, letterSpacing:'0.06em', lineHeight:1, textTransform:'uppercase' }}>
                  {item.label}
                </span>
                {item.badge && unread > 0 && (
                  <span style={{
                    position:'absolute', top:5, right:5,
                    width:14, height:14, borderRadius:'50%',
                    background:'var(--danger)', color:'white',
                    fontSize:8, fontWeight:700,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    border:'2px solid var(--ink2)',
                  }}>{unread > 9 ? '9+' : unread}</span>
                )}
              </NavLink>
            )
          )}
        </nav>

        {/* User + logout at bottom */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'0 7px', width:'100%' }}>
          <div style={{ width:28, height:1, background:'var(--wire)' }} />
          {/* Bell */}
          <button title="Notificaciones" style={{
            width:40, height:40, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center',
            background:'transparent', border:'none', cursor:'pointer', color:'var(--text3)',
            position:'relative', transition:'color 0.1s',
          }}
            onMouseEnter={e=>e.currentTarget.style.color='var(--text)'}
            onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}
          >
            <I path={ICONS.bell} size={17} />
            {unread > 0 && (
              <span style={{ position:'absolute', top:6, right:6, width:7, height:7, borderRadius:'50%', background:'var(--danger)', border:'2px solid var(--ink2)' }} />
            )}
          </button>
          {/* Avatar */}
          <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--ink4)', border:'1px solid var(--wire2)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--go)', fontFamily:'"Bebas Neue"', fontSize:13, letterSpacing:'0.05em', cursor:'default' }} title={`${user?.firstName} ${user?.lastName}`}>
            {initials}
          </div>
          {/* Logout */}
          <button title="Salir" style={{
            width:32, height:32, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center',
            background:'transparent', border:'none', cursor:'pointer', color:'var(--text3)',
            transition:'color 0.12s',
          }}
            onMouseEnter={e=>e.currentTarget.style.color='var(--danger)'}
            onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}
            onClick={()=>{ logout(); navigate('/login'); }}
          >
            <I path={ICONS.exit} size={15} />
          </button>
        </div>
      </aside>

      {/* ── MAIN ──────────────────────────────────────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Topbar — thin, minimal */}
        <header style={{
          height: 44,
          display: 'flex', alignItems: 'center',
          padding: '0 24px',
          borderBottom: '1px solid var(--wire)',
          background: 'var(--ink2)',
          gap: 12,
          flexShrink: 0,
        }}>
          {/* Org name */}
          <span style={{ fontFamily:'"DM Mono"', fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text3)' }}>
            {user?.organizationName || 'SUGA'}
          </span>

          <span style={{ flex:1 }} />

          {/* Date */}
          <span style={{ fontFamily:'"DM Mono"', fontSize:10, color:'var(--text3)' }}>
            {new Date().toLocaleDateString('es-CO',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).toUpperCase()}
          </span>

          {/* Role badge */}
          <span style={{
            fontFamily:'"DM Mono"', fontSize:9, letterSpacing:'0.08em', textTransform:'uppercase',
            padding:'2px 8px', borderRadius:3,
            background: isAdmin ? 'var(--go-dim)' : 'var(--ink4)',
            color: isAdmin ? 'var(--go)' : 'var(--text3)',
            border: `1px solid ${isAdmin ? 'rgba(200,255,0,0.2)' : 'var(--wire)'}`,
          }}>
            {isAdmin ? 'admin' : 'miembro'}
          </span>
        </header>

        {/* Content */}
        <main className="grid-lines" style={{ flex:1, overflowY:'auto', padding:'28px 28px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
