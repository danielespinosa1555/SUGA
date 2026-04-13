<<<<<<< HEAD
# SUGA — Sistema Universal de Gestión de Asistencia

**Stack:** React 18 + Vite · Node.js + Express · PostgreSQL

---

## Tabla de contenidos

1. [Estructura del proyecto](#estructura)
2. [Instalación paso a paso](#instalacion)
3. [Configurar Gmail para envío de correos](#gmail)
4. [Variables de entorno completas](#variables)
5. [Configurar Google OAuth](#google-oauth)
6. [Credenciales de demo](#demo)
7. [Endpoints API](#endpoints)
8. [Funcionalidades](#funcionalidades)
9. [Correcciones aplicadas v1.1](#correcciones)

---

## Estructura del proyecto <a name="estructura"></a>

```
suga/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js      → Conexión PostgreSQL (pool)
│   │   │   ├── migrate.js       → Crea todas las tablas y vistas SQL
│   │   │   ├── seed.js          → Datos de prueba (9 usuarios, 9 sesiones)
│   │   │   ├── passport.js      → Estrategias JWT y Google OAuth
│   │   │   └── mailer.js        → Nodemailer + 5 plantillas HTML de email
│   │   ├── controllers/
│   │   │   ├── authController.js          → Login, registro, OAuth, 2FA, reset password
│   │   │   ├── sessionController.js       → CRUD sesiones + auto-asignación asistencia
│   │   │   ├── attendanceController.js    → Marcar asistencia, resumen, calendario
│   │   │   ├── justificationController.js → Flujo completo + visor de archivos autenticado
│   │   │   ├── userController.js          → CRUD usuarios + estadísticas de asistencia
│   │   │   └── reportController.js        → Dashboard, reportes, exportación PDF/Excel
│   │   ├── middleware/
│   │   │   ├── auth.js          → requireAuth, requireAdmin, generateToken
│   │   │   ├── upload.js        → Multer (PDF/JPG/PNG, máx 5MB)
│   │   │   └── errorHandler.js  → Manejo centralizado de errores
│   │   └── routes/index.js      → Todas las rutas con sus middlewares
│   ├── uploads/                 → Archivos subidos (se crea automáticamente)
│   ├── .env.example             → Plantilla de variables de entorno
│   └── package.json
└── frontend/
    └── src/
        ├── pages/               → Una página por vista
        ├── components/ui/       → Componentes reutilizables (Modal, Badge, etc.)
        ├── services/api.js      → Cliente Axios + helpers de descarga
        └── context/authStore.js → Estado global de autenticación (Zustand)
```

---

## Instalación paso a paso <a name="instalacion"></a>

### Requisitos previos
- Node.js 18 o superior
- PostgreSQL 14 o superior

### 1. Clonar y preparar

```bash
# Descomprimir el proyecto
tar -xzf suga-fixed.tar.gz
cd suga
```

### 2. Crear la base de datos

```bash
psql -U postgres -c "CREATE DATABASE suga_db;"
```

### 3. Configurar el backend

```bash
cd backend
npm install
cp .env.example .env
```

Ahora edita el archivo `.env` con tus datos (ver sección Variables de entorno).

```bash
# Crear todas las tablas, triggers, índices y vista SQL
npm run db:migrate

# Insertar datos de prueba (opcional)
npm run db:seed

# Iniciar el servidor
npm run dev      # Desarrollo (puerto 5000, con hot-reload)
npm start        # Producción
```

### 4. Configurar el frontend

```bash
cd ../frontend
npm install
npm run dev      # Puerto 3000
```

Abre `http://localhost:3000` en tu navegador.

### Con Docker (alternativa)

```bash
# Desde la raíz del proyecto
docker-compose up --build
```

Levanta PostgreSQL, backend y frontend automáticamente.

---

## Configurar Gmail para envío de correos <a name="gmail"></a>

SUGA usa Gmail para enviar correos de recuperación de contraseña, notificaciones de justificaciones y alertas de asistencia. Sigue estos pasos exactos:

### Paso 1 — Activar la verificación en 2 pasos

1. Ve a [myaccount.google.com](https://myaccount.google.com)
2. Haz clic en **Seguridad** en el menú de la izquierda
3. Busca **Verificación en 2 pasos** y actívala si no está activa
4. Sigue el asistente hasta completarla

> ⚠️ Sin la verificación en 2 pasos activa, Google no permite crear contraseñas de app.

### Paso 2 — Crear una contraseña de app

1. En la misma sección **Seguridad**, busca **Contraseñas de app**
   (también puedes ir directamente a: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords))
2. En el campo "Selecciona la app" elige **Otra (nombre personalizado)**
3. Escribe un nombre como `SUGA`
4. Haz clic en **Generar**
5. Google te mostrará una contraseña de **16 caracteres** (ejemplo: `abcd efgh ijkl mnop`)
6. Cópiala — solo se muestra una vez

### Paso 3 — Configurar en .env

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tucorreo@gmail.com
SMTP_PASS=abcdefghijklmnop    # Pega aquí los 16 caracteres SIN espacios
EMAIL_FROM=noreply@tusistema.com
```

### Verificar que funciona

Después de configurar, intenta la función "Olvidé mi contraseña" en el login. Si el correo llega, está funcionando. Si no llega:

- Revisa que `SMTP_USER` y `SMTP_PASS` estén correctos en `.env`
- Verifica que no tengas filtros de spam activos
- Mira los logs del backend — si hay error de autenticación aparecerá con `[MAILER] ❌`

> **Modo sin email:** Si dejas `SMTP_USER` o `SMTP_PASS` vacíos, el sistema funciona igual pero los emails se muestran como `console.log` en la terminal. Útil para desarrollo local.

### Usar otro proveedor de email

Cambia `SMTP_HOST` y `SMTP_PORT` según tu proveedor:

| Proveedor | SMTP_HOST | SMTP_PORT |
|-----------|-----------|-----------|
| Gmail | smtp.gmail.com | 587 |
| Outlook / Hotmail | smtp.office365.com | 587 |
| Yahoo | smtp.mail.yahoo.com | 587 |
| SendGrid | smtp.sendgrid.net | 587 |
| Mailgun | smtp.mailgun.org | 587 |

Para SendGrid y Mailgun usa el API key como `SMTP_PASS`.

---

## Variables de entorno completas <a name="variables"></a>

Copia esto en tu archivo `backend/.env` y reemplaza los valores:

```env
# ── Servidor ──────────────────────────────────────────────────────────────────
PORT=5000
NODE_ENV=development          # cambiar a 'production' en servidor

# ── Base de datos PostgreSQL ──────────────────────────────────────────────────
DB_HOST=localhost              # o la IP de tu servidor de BD
DB_PORT=5432
DB_NAME=suga_db
DB_USER=postgres
DB_PASSWORD=tu_contraseña_postgres

# ── JWT (autenticación) ────────────────────────────────────────────────────────
# IMPORTANTE: Cambia esto por una cadena aleatoria larga. Nunca la compartas.
# Genera una en: https://randomkeygen.com (usa "Strong Passwords")
JWT_SECRET=pon_aqui_una_clave_secreta_muy_larga_y_aleatoria_minimo_32_caracteres
JWT_EXPIRES_IN=8h              # Tiempo de sesión: 8h, 24h, 7d, etc.

# ── Email SMTP ────────────────────────────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tucorreo@gmail.com
SMTP_PASS=xxxxxxxxxxxxxxxx     # App Password de Google (16 chars, sin espacios)
EMAIL_FROM=noreply@tusistema.com

# ── Google OAuth (opcional) ────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=             # Ver sección "Configurar Google OAuth"
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# ── URL del frontend ───────────────────────────────────────────────────────────
FRONTEND_URL=http://localhost:3000
# En producción: FRONTEND_URL=https://tudominio.com

# ── Archivos subidos ───────────────────────────────────────────────────────────
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880          # 5MB en bytes
```

---

## Configurar Google OAuth <a name="google-oauth"></a>

Google OAuth es **opcional**. Si no lo configuras, los usuarios solo podrán entrar con email y contraseña.

### Paso 1 — Crear proyecto en Google Cloud

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Haz clic en el selector de proyecto (arriba a la izquierda) → **Nuevo proyecto**
3. Dale un nombre como `SUGA` → **Crear**

### Paso 2 — Configurar la pantalla de consentimiento OAuth

1. En el menú lateral: **APIs y servicios → Pantalla de consentimiento de OAuth**
2. Tipo de usuario: **Externo** → Crear
3. Completa los campos obligatorios:
   - Nombre de la app: `SUGA`
   - Correo de asistencia: tu correo
   - Correo de contacto: tu correo
4. Haz clic en **Guardar y continuar** hasta terminar

### Paso 3 — Crear las credenciales

1. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**
2. Tipo de aplicación: **Aplicación web**
3. Nombre: `SUGA Web`
4. En **Orígenes de JavaScript autorizados** agrega:
   ```
   http://localhost:3000
   ```
5. En **URIs de redireccionamiento autorizados** agrega:
   ```
   http://localhost:5000/api/auth/google/callback
   ```
6. Haz clic en **Crear**
7. Copia el **ID de cliente** y el **Secreto del cliente**

### Paso 4 — Pegar en .env

```env
GOOGLE_CLIENT_ID=123456789-abcdefghijklmno.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
```

> **En producción:** reemplaza `localhost` por tu dominio real en todos los campos.

---

## Credenciales de demo <a name="demo"></a>

Después de ejecutar `npm run db:seed`:

```
Administrador:  admin@suga.app     /  demo1234
Miembro:        carlos@corp.com    /  demo1234
Miembro:        lucia@corp.com     /  demo1234
```

---

## Endpoints API <a name="endpoints"></a>

Todos los endpoints van precedidos de `/api`. El token JWT va en el header:
```
Authorization: Bearer <token>
```

### Autenticación

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/auth/register` | Registro + crea organización | No |
| POST | `/auth/login` | Login (email + contraseña) | No |
| POST | `/auth/forgot-password` | Envía email de recuperación | No |
| POST | `/auth/reset-password` | Restablecer con token | No |
| GET  | `/auth/me` | Obtener perfil actual | Sí |
| POST | `/auth/setup-2fa` | Iniciar configuración 2FA | Sí |
| POST | `/auth/verify-2fa` | Activar 2FA con código TOTP | Sí |
| GET  | `/auth/google` | Redirigir a Google OAuth | No |
| POST | `/auth/setup-organization` | Crear org para usuarios Google nuevos | Sí |

### Sesiones

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET  | `/sessions` | Listar sesiones (paginado) | Sí |
| GET  | `/sessions/:id` | Detalle + lista de asistencia | Sí |
| POST | `/sessions` | Crear sesión | Admin |
| PUT  | `/sessions/:id` | Editar sesión | Admin |
| DELETE | `/sessions/:id` | Eliminar sesión (soft delete) | Admin |

### Asistencia

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/attendance/bulk` | Guardar asistencia de una sesión | Admin |
| PATCH | `/attendance/:id` | Actualizar un registro | Admin |
| GET  | `/attendance/summary` | Resumen de todos los usuarios | Sí |
| GET  | `/attendance/user/:userId` | Historial de un usuario | Sí |
| GET  | `/attendance/calendar/:userId` | Vista mensual | Sí |

### Justificaciones

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET  | `/justifications` | Listar (admin: todas; miembro: las propias) | Sí |
| POST | `/justifications` | Enviar justificación con archivo | Sí |
| GET  | `/justifications/my-absences` | Ausencias que puedo justificar | Sí |
| GET  | `/justifications/:id/file` | **Ver/descargar archivo adjunto** | Sí |
| PATCH | `/justifications/:id/review` | Aprobar / rechazar | Admin |

### Reportes

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/reports/dashboard` | KPIs: promedio, en riesgo, pendientes | Sí |
| GET | `/reports/general?startDate=&endDate=&group=` | Reporte por período | Admin |
| GET | `/reports/user/:userId?startDate=&endDate=` | Historial individual | Sí |
| GET | `/reports/session/:id` | Detalle de una sesión | Admin |
| GET | `/reports/export/pdf?type=general|session|user` | Descargar PDF | Admin |
| GET | `/reports/export/excel?type=general|session|user` | Descargar Excel | Admin |

### Otros

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET   | `/users` | Listar usuarios + estadísticas | Sí |
| POST  | `/users` | Crear usuario | Admin |
| PUT   | `/users/:id` | Editar usuario | Admin |
| PATCH | `/users/:id/toggle` | Activar/desactivar | Admin |
| GET   | `/organization` | Datos de la organización | Sí |
| PUT   | `/organization` | Actualizar nombre, email, umbral | Admin |
| GET   | `/notifications` | Notificaciones del usuario | Sí |
| PATCH | `/notifications/read` | Marcar todas como leídas | Sí |
| GET   | `/health` | Estado del servidor | No |

---

## Funcionalidades <a name="funcionalidades"></a>

### Para el Administrador
- Crear, editar y eliminar sesiones con fecha, hora, grupo y ubicación
- Marcar asistencia en checklist (presente / ausente / tardanza / justificado)
- Ver todas las justificaciones de todos los miembros con filtro por estado
- **Ver documentos adjuntos directamente en el navegador** (PDF en iframe, imágenes inline)
- Aprobar o rechazar justificaciones con comentario obligatorio al rechazar
- Ver las justificaciones de cada usuario desde la página de Usuarios
- Reportes por persona, sesión y período con exportación a PDF y Excel
- Configurar el umbral mínimo de asistencia (% configurable por organización)
- Gestionar usuarios: crear, editar, activar/desactivar

### Para el Miembro
- Ver su propio historial de asistencia
- Ver su calendario mensual con colores por estado
- Enviar justificaciones con archivo adjunto para ausencias
- Hacer seguimiento del estado de sus justificaciones (pendiente → en revisión → aprobada/rechazada)
- Reenviar justificaciones rechazadas

### Emails automáticos
- **Recuperación de contraseña** → enlace con token de 1 hora
- **Nueva justificación** → notifica a todos los admins con el motivo
- **Justificación aprobada** → notifica al miembro, confirma que su asistencia fue actualizada
- **Justificación rechazada** → notifica al miembro con el motivo del rechazo
- **Alerta de asistencia baja** → notifica al miembro cuando cae bajo el umbral (máx. 1 email cada 24h)

---

## Correcciones aplicadas v1.1 <a name="correcciones"></a>

| # | Severidad | Problema | Solución |
|---|-----------|----------|----------|
| 1 | 🔴 Crítico | `GET /api/users` rompía con error SQL — vista `v_user_attendance_summary` no existía | Corregido a `v_attendance_summary` + campos renombrados en respuesta |
| 2 | 🔴 Crítico | Login con Google creaba usuario sin `organization_id`, dejándolo inutilizable | Flujo de setup de organización obligatorio para usuarios Google nuevos |
| 3 | 🔴 Crítico | Frontend `Users.jsx` usaba `u.attendance_percentage` e `u.is_at_risk` que no existían | Corregido a `u.attendancePct` e `u.isAtRisk` según respuesta real del backend |
| 4 | 🟡 Error | `forgotPassword` solo hacía `console.log` del enlace — nunca enviaba email | Implementado envío real con Nodemailer + plantilla HTML |
| 5 | 🟡 Error | Notificaciones de alerta se duplicaban en cada guardado de asistencia | Reemplazado `ON CONFLICT DO NOTHING` sin UNIQUE por verificación de ventana de 24h |
| 6 | 🟡 Error | `createSession` solo asignaba asistencia a `role='member'`, excluía admins | Ahora incluye todos los usuarios activos de la organización |
| 7 | 🟡 Error | `Modal` no soportaba prop `wide` — el visor de archivos se cortaba | Prop `wide` implementada con `maxWidth: 780` y scroll interno |
| 8 | 🟡 Error | `MyJustifications` usaba `require()` en módulo ESM — error en runtime | Reescrito con `import` estático en el nivel del módulo |
| 9 | ✨ Nuevo | Documentos de justificación no se podían ver, solo descargar con URL directa expuesta | Endpoint autenticado `/justifications/:id/file` + visor inline (PDF en iframe, imágenes) |
| 10 | ✨ Nuevo | Admin no podía ver justificaciones de un usuario específico desde la página de Usuarios | Botón "Ver docs" en la tabla de usuarios abre panel con todas sus justificaciones |
| 11 | ✨ Nuevo | Emails de justificación no llegaban al admin al enviar, ni al miembro al revisar | Implementados en `justificationController` con plantillas HTML responsivas |
| 12 | ✨ Nuevo | Alerta de asistencia baja solo era in-app, sin email | Agregado email de alerta con porcentaje actual y umbral requerido |
=======
# SUGA
>>>>>>> 8e5cf38aa9409c72fea381fc2a8782bf15747420
