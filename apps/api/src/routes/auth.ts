import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loginSchema, registerSchema } from '@forma/core';
import { prisma } from '../db';
import { env } from '../env';
import { createSession, destroySession, DUMMY_HASH, hashPassword, requireAuth, uid, verifyPassword } from '../lib/auth';
import { HttpError, parse } from '../lib/http';
import { provisionUserDefaults } from '../services/defaults';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos.' },
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'Correo o contraseña incorrectos');
  await createSession(res, user.id);
  res.json({ ok: true });
});

authRouter.post('/register', authLimiter, async (req, res) => {
  if (!env.ALLOW_REGISTRATION) throw new HttpError(403, 'El registro de cuentas está deshabilitado');
  const { email, password } = parse(registerSchema, req.body);
  if (await prisma.user.findUnique({ where: { email } })) throw new HttpError(409, 'Ya existe una cuenta con ese correo');
  const passwordHash = await hashPassword(password);
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({ data: { email, passwordHash } });
    await provisionUserDefaults(tx, u.id);
    return u;
  });
  await createSession(res, user.id);
  res.status(201).json({ ok: true });
});

authRouter.post('/logout', async (req, res) => {
  await destroySession(req, res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: uid(req) },
    select: { id: true, email: true, profile: { select: { displayName: true } }, settings: { select: { theme: true } } },
  });
  res.json({
    id: user.id,
    email: user.email,
    displayName: user.profile?.displayName ?? null,
    hasProfile: Boolean(user.profile),
    theme: user.settings?.theme ?? 'SYSTEM',
  });
});
