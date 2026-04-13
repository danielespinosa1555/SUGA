import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './context/authStore';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import OAuthCallback from './pages/OAuthCallback';

import Dashboard    from './pages/Dashboard';
import Sessions     from './pages/Sessions';
import AttendancePage from './pages/AttendancePage';
import Justifications from './pages/Justifications';
import MyJustifications from './pages/MyJustifications';
import CalendarPage from './pages/CalendarPage';
import Reports      from './pages/Reports';
import Analytics    from './pages/Analytics';
import Users        from './pages/Users';
import Settings     from './pages/Settings';
import MyAttendance from './pages/MyAttendance';

const qc = new QueryClient({ defaultOptions: { queries: { retry:1, staleTime:30_000 } } });

const PrivateRoute = ({ children, adminOnly=false }) => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/my-attendance" replace />;
  return children;
};
const PublicRoute = ({ children }) => {
  const { user } = useAuthStore();
  if (user) return <Navigate to={user.role==='admin'?'/dashboard':'/my-attendance'} replace />;
  return children;
};

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Toaster position="bottom-right" toastOptions={{
          style:{ background:'#1A1A24', color:'#F0EFF8', border:'1px solid #2A2A3A', fontFamily:'DM Sans,sans-serif' },
          success:{ iconTheme:{ primary:'#00D2A0', secondary:'#004D3A' } },
          error:  { iconTheme:{ primary:'#FF4D6D', secondary:'#4D0018' } },
        }}/>
        <Routes>
          <Route path="/login"           element={<PublicRoute><LoginPage/></PublicRoute>}/>
          <Route path="/register"        element={<PublicRoute><RegisterPage/></PublicRoute>}/>
          <Route path="/forgot-password" element={<ForgotPasswordPage/>}/>
          <Route path="/reset-password"  element={<ResetPasswordPage/>}/>
          <Route path="/auth/callback"   element={<OAuthCallback/>}/>

          <Route path="/" element={<PrivateRoute><AppLayout/></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" replace/>}/>
            <Route path="dashboard"   element={<PrivateRoute adminOnly><Dashboard/></PrivateRoute>}/>
            <Route path="sessions"    element={<PrivateRoute adminOnly><Sessions/></PrivateRoute>}/>
            <Route path="sessions/:id/attendance" element={<PrivateRoute adminOnly><AttendancePage/></PrivateRoute>}/>
            <Route path="justifications" element={<PrivateRoute adminOnly><Justifications/></PrivateRoute>}/>
            <Route path="reports"     element={<PrivateRoute adminOnly><Reports/></PrivateRoute>}/>
            <Route path="analytics"   element={<PrivateRoute adminOnly><Analytics/></PrivateRoute>}/>
            <Route path="users"       element={<PrivateRoute adminOnly><Users/></PrivateRoute>}/>
            <Route path="settings"    element={<PrivateRoute adminOnly><Settings/></PrivateRoute>}/>
            <Route path="my-attendance"     element={<PrivateRoute><MyAttendance/></PrivateRoute>}/>
            <Route path="my-justifications" element={<PrivateRoute><MyJustifications/></PrivateRoute>}/>
            <Route path="calendar"          element={<PrivateRoute><CalendarPage/></PrivateRoute>}/>
          </Route>

          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
