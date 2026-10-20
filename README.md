# ORGO

Aplicación personal de recomposición corporal: peso y medidas, hidratación y refresco, hábitos,
actividad, sueño y alimentación sencilla. Interfaz en español (México), mobile-first, modo claro/oscuro.

> La información de la app es orientativa y no sustituye la valoración de un profesional de la salud.

## Estado por fases

| Fase | Contenido | Estado |
| --- | --- | --- |
| 1 | Monorepo, esquema PostgreSQL completo (22 entidades), migraciones, autenticación por sesión, layout y navegación, perfil inicial (seed) | ✅ |
| 2 | Mi día + "Tu siguiente paso", peso/medidas (gráfica, promedio móvil, tendencia, hitos), hidratación y refresco con metas progresivas, hábitos (automáticos y manuales) | ✅ |
| 3 | Calendario A/B y progresión **ya calculados**; registro rápido de sesiones. Pendiente: modo de entrenamiento guiado con temporizador y registro por serie | Parcial |
| 4 | Registro sencillo de comidas y sueño (con cruce de medianoche). Pendiente: modo detallado, biblioteca de alimentos, planeador, lista de compras, revisión semanal | Parcial |
| 5 | Estadísticas, PWA/offline, notificaciones, asistente "Mi guía" | Pendiente |
| 6 | Endurecimiento, optimización y despliegue | Base lista (ver abajo) |

**Notificaciones push: implementadas** (ver abajo). **Aún no hay soporte offline ni asistente.** El esquema y los UUID generados en el cliente
(con creación idempotente en la API) ya están preparados para la cola de sincronización offline.

## Estructura

```
forma/
├── packages/core      Lógica de negocio pura + esquemas Zod compartidos (probada con Vitest)
├── apps/api           Express 5 + Prisma 6 + PostgreSQL (REST, sesiones HTTP-only)
└── apps/web           React 19 + Vite + Tailwind 4 + TanStack Query + Recharts
```

- `packages/core` no depende de React ni de la base de datos: fechas por zona horaria, IMC, Mifflin-St Jeor,
  semanas de programa, metas progresivas, alternancia de rutinas, progresión, sueño, tendencias de peso,
  evaluación de hábitos y reglas de "Tu siguiente paso".
- Los registros guardan el instante (UTC) y el **día local** del usuario (`UserSettings.timezone`,
  por defecto `America/Mexico_City`), que es el que se usa para agrupar.
- Unidades canónicas: kg, cm, ml, kcal, g, minutos.

## Requisitos

- Node.js ≥ 22 y pnpm ≥ 10
- PostgreSQL ≥ 14

## Puesta en marcha local

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # y edita los valores
createdb forma && createdb forma_test
pnpm db:migrate                          # aplica migraciones
pnpm db:seed                             # crea tu usuario con el perfil inicial (sin historiales)
pnpm dev                                 # API en :4000 y web en :5173
```

Abre http://localhost:5173 e inicia sesión con `SEED_USER_EMAIL` / `SEED_USER_PASSWORD`.

### Variables de entorno (`apps/api/.env`)

| Variable | Descripción |
| --- | --- |
| `DATABASE_URL` | Cadena de conexión de PostgreSQL |
| `PORT` | Puerto de la API (por defecto 4000) |
| `CORS_ORIGINS` | Orígenes permitidos, separados por coma (p. ej. la URL de Vercel) |
| `ALLOW_REGISTRATION` | `true` para permitir crear cuentas nuevas (por defecto `false`) |
| `TRUST_PROXY` | Número de proxies de confianza (Railway: `1`) para obtener la IP real en el rate limit |
| `NODE_ENV` | `production` activa cookies `Secure` |
| `SEED_USER_EMAIL`, `SEED_USER_PASSWORD`, `SEED_USER_NAME` | Sólo para `pnpm db:seed` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Llaves Web Push. Sin ellas, las notificaciones quedan desactivadas |

Para las pruebas: `cp apps/api/.env.test.example apps/api/.env.test` (apunta a `forma_test`; las pruebas la vacían).

## Pruebas

```bash
pnpm test
```

- `packages/core`: IMC, energía, semanas/metas progresivas, alternancia A/B, progresión sin subir con dolor/fatiga,
  sueño que cruza medianoche, regularidad, promedios móviles, tendencia, proyección, hitos, hábitos, siguiente paso.
- `apps/api` (contra PostgreSQL real): autenticación y cookie HTTP-only, protección de origen, idempotencia,
  agrupación por día local, edición y eliminación, validación, aislamiento de datos entre usuarios,
  exportación y eliminación de cuenta.

## Despliegue

Todo vive en **Vercel** (cuenta personal, plan Hobby): https://forma-three-blush.vercel.app

- **Web**: `apps/web` compilada a `apps/web/dist`.
- **API**: la app de Express como Vercel Function (`api/index.js` → `apps/api/dist/vercel.js`); `/api/*` se reescribe a ella,
  así que web y API comparten dominio (cookie SameSite=Lax).
- **Base de datos**: Neon Postgres del Marketplace de Vercel (`DATABASE_URL` con pooler, `DATABASE_URL_UNPOOLED` para migraciones).
- **Build** (`pnpm vercel-build`): `prisma migrate deploy` → compila la API → seed si existen `SEED_USER_EMAIL`/`SEED_USER_PASSWORD` → compila la web.
- **Recordatorios**: el plan Hobby sólo permite cron diario, así que **Upstash QStash** (Marketplace) llama
  `POST /api/cron/reminders` cada 5 minutos con firma verificada (`QSTASH_*_SIGNING_KEY`); también acepta
  `Authorization: Bearer $CRON_SECRET`.
- Variables en Vercel (producción): `VAPID_*`, `TRUST_PROXY=1`, `CORS_ORIGINS`, `CRON_SECRET`, más las que crean Neon y QStash.
- Redesplegar: `vercel deploy --prod`.

## Notificaciones push

Recordatorios Web Push que se envían sólo cuando aplican según tus registros reales
(reglas en `packages/core/src/reminders.ts`, con pruebas):

| Recordatorio | Cuándo |
| --- | --- |
| Entrenamiento | A tu hora de entrenar, si hoy toca fuerza o caminata y aún no la registras |
| Agua | 3, 6, 9 y 12 h después de despertar, sólo si vas por debajo del ritmo de tu meta |
| Hora de dormir | 45 min antes de tu hora objetivo |
| Peso semanal | El día de revisión, 30 min después de despertar, si no te has pesado esa semana |

- QStash dispara la revisión cada 5 minutos en producción (en local, el servidor revisa cada minuto); cada aviso se envía una sola vez por día y turno
  (tabla `NotificationLog` con clave única, segura con varias instancias).
- Generar llaves: `node -e "console.log(require('web-push').generateVAPIDKeys())"`.
- **iPhone:** requiere iOS 16.4+, HTTPS y la app **agregada a la pantalla de inicio** (Compartir → Agregar a inicio).
  Después, en la app: Yo → Notificaciones → Activar. En `http://` por red local no funciona; usa el despliegue con HTTPS.
- El service worker (`apps/web/public/sw.js`) por ahora sólo maneja push; no guarda nada en caché.

## Seguridad y privacidad

- Contraseñas con scrypt (parámetros incluidos en el hash); sesiones aleatorias de 256 bits guardadas como SHA-256,
  cookie `HttpOnly`, `SameSite=Lax`, `Secure` en producción, expiración deslizante de 30 días.
- Mutaciones sólo desde orígenes permitidos (además de SameSite y JSON obligatorio); `helmet`; límite de intentos de login.
- Toda consulta filtra por `userId`; acceder a registros de otro usuario devuelve 404.
- Respuestas de la API con `Cache-Control: no-store`; los logs no incluyen cuerpos de petición.
- Exportación completa de datos (JSON) y eliminación de cuenta con contraseña + confirmación (borrado en cascada).
- Sin analítica ni uso de datos para entrenar modelos (`analyticsOptIn` y `aiDataSharingOptIn` en `false`).

## Fórmulas y limitaciones

- **IMC** = kg / m². Clasificación OMS. No distingue músculo de grasa.
- **Metabolismo basal** (Mifflin-St Jeor): 10·kg + 6.25·cm − 5·edad + 5 (hombres) / − 161 (mujeres).
  **Gasto diario** = basal × factor de actividad (1.2–1.9). Error individual típico ±10 % o más.
- **Promedio móvil**: media de los registros de los últimos 7 días naturales; no interpola.
- **Tendencia**: regresión lineal sobre los últimos 28 días; requiere ≥ 3 días con registro que abarquen ≥ 7 días.
- **Proyección**: sólo si la tendencia apunta a la meta y resulta < 3 años; se presenta como estimación condicionada.
- **Metas progresivas**: por semana de programa (semana 1 = 7 días desde el inicio); tras la última, se mantiene la última.
- **Rutinas**: semanas lunes–domingo; semanas pares A/B/A, impares B/A/B. Si el inicio cae en domingo, la primera
  semana de entrenamiento es la que empieza el lunes siguiente.
- **Progresión**: sube un nivel por cada semana completada sin reportes de dolor, fatiga excesiva o mala recuperación.
- **Hábitos automáticos**: se evalúan con registros reales; los días sin datos no cuentan como fallos y los días previos
  a la creación del hábito no se evalúan. El registro manual prevalece.
- **Sueño**: se asigna al día del despertar; si la hora de despertar es anterior a la de acostarse, cruza medianoche.
