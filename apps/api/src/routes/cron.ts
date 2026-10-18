import { Receiver } from '@upstash/qstash';
import express, { Router } from 'express';
import { prisma } from '../db';
import { env } from '../env';
import { HttpError } from '../lib/http';
import { runReminderTick } from '../services/push';

/**
 * Disparador de recordatorios. En Vercel (plan Hobby) los cron nativos sólo corren una vez al día,
 * así que QStash lo llama cada 5 minutos con una firma que aquí se verifica.
 */
export const cronRouter = Router();

const receiver =
  env.QSTASH_CURRENT_SIGNING_KEY && env.QSTASH_NEXT_SIGNING_KEY
    ? new Receiver({ currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY, nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY })
    : null;

async function authorized(req: express.Request): Promise<boolean> {
  if (env.CRON_SECRET && req.get('authorization') === `Bearer ${env.CRON_SECRET}`) return true;
  const signature = req.get('upstash-signature');
  if (receiver && signature) {
    const body = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    return receiver.verify({ signature, body }).catch(() => false);
  }
  return false;
}

cronRouter.post('/reminders', express.raw({ type: () => true, limit: '10kb' }), async (req, res) => {
  if (!(await authorized(req))) throw new HttpError(401, 'No autorizado');
  await runReminderTick();
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  res.json({ ok: true });
});
