import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db';
import { env } from '../env';
import { HttpError } from './http';

// --- Contraseñas (scrypt, parámetros incluidos en el hash para poder migrarlos) ---

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, SCRYPT.keylen, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, N, r, p, saltB64, keyB64] = stored.split('$');
  if (alg !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Hash ficticio para igualar tiempos cuando el usuario no existe. */
export const DUMMY_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

// --- Sesiones ----------------------------------------------------------------

export const SESSION_COOKIE = 'forma_session';
const SESSION_DAYS = 30;
const SESSION_TTL_MS = SESSION_DAYS * 86_400_000;

const tokenId = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(res: Response, userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { id: tokenId(token), userId, expiresAt } });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
}

export async function destroySession(req: Request, res: Response) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === 'string') await prisma.session.deleteMany({ where: { id: tokenId(token) } });
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/** Requiere sesión válida; renueva la expiración como máximo una vez al día. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== 'string' || token.length < 20) throw new HttpError(401, 'Inicia sesión para continuar');
  const session = await prisma.session.findUnique({ where: { id: tokenId(token) } });
  if (!session || session.expiresAt < new Date()) throw new HttpError(401, 'Tu sesión expiró');
  if (Date.now() - session.lastSeenAt.getTime() > 86_400_000) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    });
  }
  req.userId = session.userId;
  next();
}

export function uid(req: Request): string {
  if (!req.userId) throw new HttpError(401, 'Inicia sesión para continuar');
  return req.userId;
}

/**
 * Defensa CSRF: además de SameSite=Lax y de exigir JSON, las peticiones que
 * modifican datos deben venir de un origen permitido.
 */
export function originGuard(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin) {
    const host = req.get('host');
    const sameHost = host && (origin === `https://${host}` || origin === `http://${host}`);
    if (!sameHost && !env.corsOrigins.includes(origin)) throw new HttpError(403, 'Origen no permitido');
  }
  next();
}
