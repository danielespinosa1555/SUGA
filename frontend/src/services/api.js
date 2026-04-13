import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('suga_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('suga_token');
      localStorage.removeItem('suga_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

export const authAPI = {
  login:                (d)    => api.post('/auth/login', d),
  register:             (d)    => api.post('/auth/register', d),
  join:                 (d)    => api.post('/auth/join', d),
  validateInviteCode:   (code) => api.get(`/auth/validate-code/${code}`),
  getMe:                ()     => api.get('/auth/me'),
  forgotPassword:       (email)=> api.post('/auth/forgot-password', { email }),
  resetPassword:        (d)    => api.post('/auth/reset-password', d),
  validateResetToken:   (token)=> api.get(`/auth/validate-reset-token/${token}`),
  testEmail:            (to)   => api.post('/auth/test-email', { to }),
  setup2FA:             ()     => api.post('/auth/setup-2fa'),
  verify2FA:            (code) => api.post('/auth/verify-2fa', { code }),
  setupOrganization:    (d)    => api.post('/auth/setup-organization', d),
  regenerateInviteCode: ()     => api.post('/auth/invite-code/regenerate'),
  googleLogin:          ()     => { window.location.href = '/api/auth/google'; },
};

export const usersAPI = {
  getAll:  (p)    => api.get('/users', { params: p }),
  create:  (d)    => api.post('/users', d),
  update:  (id,d) => api.put(`/users/${id}`, d),
  toggle:  (id)   => api.patch(`/users/${id}/toggle`),
};

export const sessionsAPI = {
  getAll:   (p)    => api.get('/sessions', { params: p }),
  getOne:   (id)   => api.get(`/sessions/${id}`),
  create:   (d)    => api.post('/sessions', d),
  update:   (id,d) => api.put(`/sessions/${id}`, d),
  delete:   (id)   => api.delete(`/sessions/${id}`),
  circular: (id,d) => api.post(`/sessions/${id}/circular`, d),
};

export const attendanceAPI = {
  saveBulk:      (d)        => api.post('/attendance/bulk', d),
  update:        (id,d)     => api.patch(`/attendance/${id}`, d),
  getSummary:    (p)        => api.get('/attendance/summary', { params: p }),
  getUserHistory:(userId)   => api.get(`/attendance/user/${userId}`),
  getCalendar:   (userId,p) => api.get(`/attendance/calendar/${userId}`, { params: p }),
};

export const justificationsAPI = {
  getAll:        (p)   => api.get('/justifications', { params: p }),
  getMyAbsences: ()    => api.get('/justifications/my-absences'),
  create:        (fd)  => api.post('/justifications', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  review:        (id,d)=> api.patch(`/justifications/${id}/review`, d),
  getMessages:   (id)  => api.get(`/justifications/${id}/messages`),
  sendMessage:   (id,d)=> api.post(`/justifications/${id}/messages`, d),
  getFileBlobUrl: async (id) => {
    const token = localStorage.getItem('suga_token');
    const res = await fetch(`/api/justifications/${id}/file`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('No se pudo obtener el archivo');
    const blob = await res.blob();
    return { url: URL.createObjectURL(blob), type: blob.type };
  },
};

export const reportsAPI = {
  dashboard: ()      => api.get('/reports/dashboard'),
  user:      (uid,p) => api.get(`/reports/user/${uid}`, { params: p }),
  session:   (sid)   => api.get(`/reports/session/${sid}`),
  general:   (p)     => api.get('/reports/general', { params: p }),
  exportPDF:   (p)   => api.get('/reports/export/pdf',   { params: p, responseType: 'blob' }),
  exportExcel: (p)   => api.get('/reports/export/excel', { params: p, responseType: 'blob' }),
};

export const notificationsAPI = {
  getAll:   () => api.get('/notifications'),
  markRead: () => api.patch('/notifications/read'),
};

export const orgAPI = {
  get:    ()  => api.get('/organization'),
  update: (d) => api.put('/organization', d),
};

export const downloadFile = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
