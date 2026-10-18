import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { toDateKey } from '@forma/core';
import { createApp } from './app';
import { prisma } from './db';
import { runReminderTick } from './services/push';

const app = createApp();
const ORIGIN = 'http://localhost:5173';
const TODAY = toDateKey(new Date(), 'America/Mexico_City');

async function agentFor(email: string) {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').set('Origin', ORIGIN).send({ email, password: 'contraseña-segura-1' }).expect(201);
  await agent
    .put('/api/profile')
    .set('Origin', ORIGIN)
    .send({
      displayName: 'Prueba',
      ageYears: 21,
      sexForEstimates: 'MALE',
      heightCm: 169,
      startWeightKg: 95,
      targetWeightKg: 75,
      activityLevel: 'SEDENTARY',
      primaryGoal: 'Recomposición corporal',
      secondaryGoals: [],
      programStartDate: '2026-10-18',
      firstReviewDate: '2026-10-24',
      trainingDaysPerWeek: 5,
      sessionMinutes: 30,
    })
    .expect(200);
  return agent;
}

let a: ReturnType<typeof request.agent>;
let b: ReturnType<typeof request.agent>;

beforeAll(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "User" CASCADE');
  a = await agentFor('a@forma.test');
  b = await agentFor('b@forma.test');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('autenticación', () => {
  it('rechaza peticiones sin sesión', async () => {
    await request(app).get('/api/today').expect(401);
  });
  it('rechaza credenciales incorrectas', async () => {
    await request(app).post('/api/auth/login').send({ email: 'a@forma.test', password: 'mala' }).expect(401);
  });
  it('inicia sesión con cookie HTTP-only', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@forma.test', password: 'contraseña-segura-1' })
      .expect(200);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });
  it('bloquea mutaciones desde orígenes no permitidos', async () => {
    await a
      .post('/api/beverages')
      .set('Origin', 'https://malicioso.example')
      .send({ id: randomUUID(), type: 'WATER', volumeMl: 250, loggedAt: new Date().toISOString() })
      .expect(403);
  });
  it('el perfil y los valores por defecto se crean', async () => {
    const res = await a.get('/api/profile').expect(200);
    expect(res.body.profile.startWeightKg).toBe(95);
    expect(res.body.estimates.startBmi).toBeCloseTo(33.3, 1);
    expect(res.body.settings.glassSizeMl).toBe(355);
    const goals = await a.get('/api/hydration/goals').expect(200);
    expect(goals.body).toHaveLength(4);
  });
});

describe('registros idempotentes, edición y eliminación', () => {
  it('reintentar un POST con el mismo id no duplica', async () => {
    const body = { id: randomUUID(), type: 'WATER', volumeMl: 250, loggedAt: '2026-10-19T16:00:00.000Z' };
    await a.post('/api/beverages').set('Origin', ORIGIN).send(body).expect(201);
    await a.post('/api/beverages').set('Origin', ORIGIN).send(body).expect(200);
    const day = await a.get('/api/hydration/day?date=2026-10-19').expect(200);
    expect(day.body.logs).toHaveLength(1);
    expect(day.body.waterMl).toBe(250);
    expect(day.body.waterGoalMl).toBe(1200);
  });
  it('agrupa por día local del usuario (no UTC)', async () => {
    // 05:30 UTC del 20 = 23:30 del 19 en CDMX
    await a
      .post('/api/beverages')
      .set('Origin', ORIGIN)
      .send({ id: randomUUID(), type: 'SODA_REGULAR', volumeMl: 355, loggedAt: '2026-10-20T05:30:00.000Z' })
      .expect(201);
    const day = await a.get('/api/hydration/day?date=2026-10-19').expect(200);
    expect(day.body.sodaGlasses).toBe(1);
  });
  it('edita y elimina mediciones', async () => {
    const id = randomUUID();
    await a.post('/api/measurements').set('Origin', ORIGIN).send({ id, measuredAt: '2026-10-18T15:00:00Z', weightKg: 95 }).expect(201);
    const upd = await a.patch(`/api/measurements/${id}`).set('Origin', ORIGIN).send({ weightKg: 94.8, waistCm: 108 }).expect(200);
    expect(upd.body.weightKg).toBe(94.8);
    expect(upd.body.waistCm).toBe(108);
    await a.patch(`/api/measurements/${id}`).set('Origin', ORIGIN).send({ weightKg: null, waistCm: null }).expect(400);
    await a.delete(`/api/measurements/${id}`).set('Origin', ORIGIN).expect(204);
    await a.delete(`/api/measurements/${id}`).set('Origin', ORIGIN).expect(404);
  });
  it('valida entradas', async () => {
    await a.post('/api/measurements').set('Origin', ORIGIN).send({ id: randomUUID(), measuredAt: '2026-10-18T15:00:00Z' }).expect(400);
    await a.post('/api/beverages').set('Origin', ORIGIN).send({ id: 'x', type: 'WATER', volumeMl: 250 }).expect(400);
  });
  it('sueño que cruza medianoche se asigna al día del despertar', async () => {
    const res = await a
      .post('/api/sleep')
      .set('Origin', ORIGIN)
      .send({ id: randomUUID(), bedtime: '2026-10-19T08:00:00.000Z', wakeTime: '2026-10-19T15:30:00.000Z', quality: 3 })
      .expect(201);
    expect(res.body.durationMinutes).toBe(450);
    expect(res.body.date).toBe('2026-10-19');
  });
});

describe('aislamiento de datos entre usuarios', () => {
  it('un usuario no ve ni modifica registros de otro', async () => {
    const id = randomUUID();
    await a.post('/api/measurements').set('Origin', ORIGIN).send({ id, measuredAt: '2026-10-21T15:00:00Z', weightKg: 94.5 }).expect(201);
    const list = await b.get('/api/measurements').expect(200);
    expect(list.body.find((m: { id: string }) => m.id === id)).toBeUndefined();
    await b.patch(`/api/measurements/${id}`).set('Origin', ORIGIN).send({ weightKg: 50 }).expect(404);
    await b.delete(`/api/measurements/${id}`).set('Origin', ORIGIN).expect(404);
    // Reusar el id de otro usuario es un conflicto, no una lectura.
    await b.post('/api/measurements').set('Origin', ORIGIN).send({ id, measuredAt: '2026-10-21T15:00:00Z', weightKg: 80 }).expect(409);
    const own = await a.get('/api/measurements').expect(200);
    expect(own.body.find((m: { id: string }) => m.id === id).weightKg).toBe(94.5);
  });
  it('los hábitos de otro usuario no son accesibles', async () => {
    const habitsA = await a.get('/api/habits?date=2026-10-19').expect(200);
    const habitId = habitsA.body[0].id;
    await b.post(`/api/habits/${habitId}/complete`).set('Origin', ORIGIN).send({ date: '2026-10-19' }).expect(404);
    await b.post(`/api/habits/${habitId}/archive`).set('Origin', ORIGIN).expect(404);
  });
});

describe('hábitos', () => {
  it('evalúa automáticamente la meta de agua y permite completar/deshacer manualmente', async () => {
    const habits = await a.get(`/api/habits?date=${TODAY}`).expect(200);
    const water = habits.body.find((h: { autoRule: string }) => h.autoRule === 'WATER_GOAL');
    expect(water.today.status).not.toBe('met');
    await a.post(`/api/habits/${water.id}/complete`).set('Origin', ORIGIN).send({ date: TODAY }).expect(200);
    let after = await a.get(`/api/habits?date=${TODAY}`).expect(200);
    expect(after.body.find((h: { id: string }) => h.id === water.id).today).toMatchObject({ status: 'met', manual: true });
    await a.delete(`/api/habits/${water.id}/complete?date=${TODAY}`).set('Origin', ORIGIN).expect(200);
    after = await a.get(`/api/habits?date=${TODAY}`).expect(200);
    expect(after.body.find((h: { id: string }) => h.id === water.id).today.manual).toBe(false);
  });
  it('crea, edita y archiva hábitos', async () => {
    const created = await a.post('/api/habits').set('Origin', ORIGIN).send({ name: 'Estirar 5 min', frequency: 'DAILY' }).expect(201);
    await a.patch(`/api/habits/${created.body.id}`).set('Origin', ORIGIN).send({ name: 'Estirar 10 min' }).expect(200);
    await a.post(`/api/habits/${created.body.id}/archive`).set('Origin', ORIGIN).expect(200);
    const list = await a.get('/api/habits').expect(200);
    expect(list.body.some((h: { id: string }) => h.id === created.body.id)).toBe(false);
    const archived = await a.get('/api/habits/archived').expect(200);
    expect(archived.body[0].name).toBe('Estirar 10 min');
  });
});

describe('Mi día', () => {
  it('devuelve un resumen coherente sin inventar datos', async () => {
    const res = await b.get('/api/today').expect(200);
    expect(res.body.weight.latestKg).toBeNull();
    expect(res.body.weight.startKg).toBe(95);
    expect(res.body.habits).toHaveLength(6);
    expect(res.body.nextStep.action).toBeTypeOf('string');
  });
});

describe('foto de perfil', () => {
  // PNG de 1×1 px
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  it('se guarda, sólo la ve su dueño y valida formato y tamaño', async () => {
    await a.get('/api/profile/avatar').expect(404);
    await a.put('/api/profile/avatar').set('Origin', ORIGIN).send({ dataUrl: png }).expect(200);
    const img = await a.get('/api/profile/avatar').expect(200);
    expect(img.headers['content-type']).toContain('image/png');
    expect(img.headers['cache-control']).toContain('private');
    const prof = await a.get('/api/profile').expect(200);
    expect(prof.body.profile.avatarVersion).toBeTypeOf('number');
    await b.get('/api/profile/avatar').expect(404);
    await request(app).get('/api/profile/avatar').expect(401);
    await a.put('/api/profile/avatar').set('Origin', ORIGIN).send({ dataUrl: 'data:text/html;base64,PHA+' }).expect(400);
    const big = 'data:image/jpeg;base64,' + Buffer.alloc(320 * 1024).toString('base64');
    await a.put('/api/profile/avatar').set('Origin', ORIGIN).send({ dataUrl: big }).expect(413);
    await a.delete('/api/profile/avatar').set('Origin', ORIGIN).expect(204);
    await a.get('/api/profile/avatar').expect(404);
  });
});

describe('notificaciones push', () => {
  it('expone preferencias y permite cambiarlas', async () => {
    const res = await a.get('/api/notifications').expect(200);
    expect(res.body.preferences.map((p: { kind: string }) => p.kind)).toEqual(['TRAINING', 'HYDRATION', 'BEDTIME', 'WEIGH_IN']);
    await a.put('/api/notifications/preferences').set('Origin', ORIGIN).send({ kind: 'TRAINING', enabled: true }).expect(200);
    const after = await a.get('/api/notifications').expect(200);
    expect(after.body.preferences.find((p: { kind: string }) => p.kind === 'TRAINING').enabled).toBe(true);
    await a.put('/api/notifications/preferences').set('Origin', ORIGIN).send({ kind: 'NADA', enabled: true }).expect(400);
  });
  it('sin llaves VAPID el servidor rechaza suscripciones', async () => {
    await a
      .post('/api/push/subscribe')
      .set('Origin', ORIGIN)
      .send({ endpoint: 'https://push.example.invalid/x', keys: { p256dh: 'p256dh-key-xxxxxxxx', auth: 'auth-key-xx' } })
      .expect(503);
  });
  it('el disparador de recordatorios exige firma o secreto', async () => {
    await request(app).post('/api/cron/reminders').expect(401);
    await request(app).post('/api/cron/reminders').set('Upstash-Signature', 'falsa').expect(401);
  });
  it('el programador envía cada recordatorio una sola vez', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'a@forma.test' } });
    await prisma.pushSubscription.create({ data: { userId: user.id, endpoint: 'https://push.example.invalid/a', p256dh: 'k', auth: 'k' } });
    // Martes 20 oct 2026, 10:05 en CDMX: toca caminata y aún no se registra.
    const now = new Date('2026-10-20T16:05:00Z');
    await runReminderTick(now);
    await runReminderTick(now);
    const logs = await prisma.notificationLog.findMany({ where: { userId: user.id, kind: 'TRAINING' } });
    expect(logs).toHaveLength(1);
  });
});

describe('cuenta', () => {
  it('exporta los datos sin credenciales y elimina la cuenta con confirmación', async () => {
    const exp = await b.get('/api/account/export').expect(200);
    expect(JSON.stringify(exp.body)).not.toContain('passwordHash');
    await b.delete('/api/account').set('Origin', ORIGIN).send({ password: 'contraseña-segura-1', confirm: 'NO' }).expect(400);
    await b.delete('/api/account').set('Origin', ORIGIN).send({ password: 'contraseña-segura-1', confirm: 'ELIMINAR' }).expect(204);
    expect(await prisma.user.findUnique({ where: { email: 'b@forma.test' } })).toBeNull();
    expect(await prisma.habit.count({ where: { user: { email: 'b@forma.test' } } })).toBe(0);
  });
});
