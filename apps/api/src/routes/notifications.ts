import { Router } from 'express';
import { z } from 'zod';
import { REMINDER_LABEL } from '@forma/core';
import { prisma } from '../db';
import { env } from '../env';
import { uid } from '../lib/auth';
import { HttpError, parse } from '../lib/http';
import { PUSH_KINDS, sendToUser } from '../services/push';

export const notificationsRouter = Router();

notificationsRouter.get('/notifications', async (req, res) => {
  const userId = uid(req);
  const [prefs, devices] = await Promise.all([
    prisma.notificationPreference.findMany({ where: { userId, kind: { in: PUSH_KINDS } } }),
    prisma.pushSubscription.count({ where: { userId } }),
  ]);
  res.json({
    configured: env.pushEnabled,
    publicKey: env.pushEnabled ? env.VAPID_PUBLIC_KEY : null,
    devices,
    preferences: PUSH_KINDS.map((kind) => ({ kind, label: REMINDER_LABEL[kind], enabled: prefs.find((p) => p.kind === kind)?.enabled ?? false })),
  });
});

const prefSchema = z.object({ kind: z.enum(['TRAINING', 'HYDRATION', 'BEDTIME', 'WEIGH_IN']), enabled: z.boolean() });

notificationsRouter.put('/notifications/preferences', async (req, res) => {
  const userId = uid(req);
  const { kind, enabled } = parse(prefSchema, req.body);
  await prisma.notificationPreference.upsert({
    where: { userId_kind: { userId, kind } },
    update: { enabled },
    create: { userId, kind, enabled, weekdays: [] },
  });
  res.json({ ok: true });
});

const subSchema = z.object({
  endpoint: z.url().max(2000),
  keys: z.object({ p256dh: z.string().min(10).max(500), auth: z.string().min(8).max(200) }),
});

/** Registra el dispositivo y, la primera vez, activa los recordatorios básicos. */
notificationsRouter.post('/push/subscribe', async (req, res) => {
  if (!env.pushEnabled) throw new HttpError(503, 'Las notificaciones no están configuradas en el servidor');
  const userId = uid(req);
  const { endpoint, keys } = parse(subSchema, req.body);
  const existing = await prisma.pushSubscription.findUnique({ where: { endpoint } });
  if (existing && existing.userId !== userId) await prisma.pushSubscription.delete({ where: { id: existing.id } });
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth },
    create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: req.get('user-agent')?.slice(0, 200) },
  });
  const anyEnabled = await prisma.notificationPreference.count({ where: { userId, enabled: true } });
  if (!anyEnabled) {
    await prisma.notificationPreference.updateMany({ where: { userId, kind: { in: PUSH_KINDS } }, data: { enabled: true } });
  }
  res.status(201).json({ ok: true });
});

notificationsRouter.delete('/push/subscribe', async (req, res) => {
  const { endpoint } = parse(z.object({ endpoint: z.string().min(1) }), req.body);
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: uid(req) } });
  res.status(204).end();
});

notificationsRouter.post('/push/test', async (req, res) => {
  if (!env.pushEnabled) throw new HttpError(503, 'Las notificaciones no están configuradas en el servidor');
  const delivered = await sendToUser(uid(req), { title: 'Notificaciones activadas', body: 'Así te llegarán los recordatorios.', url: '/' });
  if (!delivered) throw new HttpError(404, 'No hay dispositivos registrados');
  res.json({ delivered });
});
