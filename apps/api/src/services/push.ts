import {
  dateKeyToUtc,
  dueReminders,
  parseClock,
  plannedActivity,
  programDay,
  weekday,
  type Reminder,
  type ReminderKind,
} from '@forma/core';
import { Prisma } from '@prisma/client';
import webpush from 'web-push';
import { prisma } from '../db';
import { env } from '../env';
import { dateKey } from '../lib/serialize';
import { loadContext } from './context';
import { buildDayAggregates } from './days';

export const PUSH_KINDS: ReminderKind[] = ['TRAINING', 'HYDRATION', 'BEDTIME', 'WEIGH_IN'];

if (env.pushEnabled) webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);

/** Envía a todos los dispositivos del usuario; borra suscripciones vencidas (404/410). */
export async function sendToUser(userId: string, payload: { title: string; body: string; url: string; tag?: string }) {
  if (!env.pushEnabled) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let delivered = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 30, urgency: 'normal' });
        delivered++;
        await prisma.pushSubscription.update({ where: { id: s.id }, data: { lastSuccessAt: new Date() } });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
        else console.error('[push] envío fallido', status ?? (err instanceof Error ? err.message : err));
      }
    }),
  );
  return delivered;
}

/** Recordatorios que tocan ahora para un usuario, calculados con sus registros reales. */
export async function remindersFor(userId: string, now = new Date()): Promise<{ reminders: Reminder[]; localDate: string }> {
  const ctx = await loadContext(userId, now);
  if (!ctx.profile || !ctx.programStart) return { reminders: [], localDate: ctx.today };
  const prefs = await prisma.notificationPreference.findMany({ where: { userId, enabled: true } });
  if (!prefs.length) return { reminders: [], localDate: ctx.today };
  const [day] = await buildDayAggregates(ctx, ctx.today, ctx.today);
  const planned = plannedActivity(ctx.programStart, ctx.today);
  const reminders = dueReminders({
    nowMinutes: ctx.nowMinutes,
    programDay: programDay(ctx.programStart, ctx.today),
    enabled: Object.fromEntries(prefs.map((p) => [p.kind, true])),
    plannedKind: planned.kind,
    plannedLabel: planned.label,
    activityDone: day!.activityDone,
    trainingMinutes: parseClock(ctx.settings.trainingTime),
    wakeMinutes: parseClock(ctx.settings.targetWakeTime),
    bedMinutes: parseClock(ctx.settings.targetBedtime),
    waterMl: day!.waterMl,
    waterGoalMl: day!.waterGoalMl,
    isWeighInDay: weekday(ctx.today) === weekday(dateKey(ctx.profile.firstReviewDate)),
    weighedThisWeek: day!.weighedThisWeek,
  });
  return { reminders, localDate: ctx.today };
}

/** Una pasada del programador: para cada usuario con dispositivos, envía lo pendiente una sola vez. */
export async function runReminderTick(now = new Date()) {
  const users = await prisma.pushSubscription.findMany({ distinct: ['userId'], select: { userId: true } });
  for (const { userId } of users) {
    try {
      const { reminders, localDate } = await remindersFor(userId, now);
      for (const r of reminders) {
        // Reservar el envío antes de mandarlo: si otra instancia ya lo hizo, la clave única lo impide.
        try {
          await prisma.notificationLog.create({ data: { userId, kind: r.kind, localDate: dateKeyToUtc(localDate), slot: r.slot } });
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
          throw err;
        }
        await sendToUser(userId, { title: r.title, body: r.body, url: r.url, tag: `${r.kind}-${r.slot}` });
      }
    } catch (err) {
      console.error('[push] error del programador', err instanceof Error ? err.message : err);
    }
  }
}

export function startReminderScheduler() {
  if (!env.pushEnabled) {
    console.log('Notificaciones push desactivadas: faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.');
    return () => undefined;
  }
  const id = setInterval(() => void runReminderTick(), 60_000);
  return () => clearInterval(id);
}
