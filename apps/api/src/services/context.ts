import type { UserProfile as FullProfile, UserSettings } from '@prisma/client';

/** Perfil sin la foto (los bytes sólo se leen en la ruta de la foto). */
export type UserProfile = Omit<FullProfile, 'avatar'>;
import { localMinutesOfDay, toDateKey, type DateKey } from '@forma/core';
import { prisma } from '../db';
import { HttpError } from '../lib/http';
import { dateKey } from '../lib/serialize';

export interface UserContext {
  userId: string;
  settings: UserSettings;
  profile: UserProfile | null;
  tz: string;
  today: DateKey;
  nowMinutes: number;
  programStart: DateKey | null;
}

export async function loadContext(userId: string, now = new Date()): Promise<UserContext> {
  const [settings, profile] = await Promise.all([
    prisma.userSettings.upsert({ where: { userId }, update: {}, create: { userId } }),
    prisma.userProfile.findUnique({ where: { userId }, omit: { avatar: true } }),
  ]);
  const tz = settings.timezone;
  return {
    userId,
    settings,
    profile,
    tz,
    today: toDateKey(now, tz),
    nowMinutes: localMinutesOfDay(now, tz),
    programStart: profile ? dateKey(profile.programStartDate) : null,
  };
}

export function requireProfile(ctx: UserContext): UserProfile & { programStart: DateKey } {
  if (!ctx.profile || !ctx.programStart) throw new HttpError(409, 'Completa tu perfil para continuar');
  return Object.assign(ctx.profile, { programStart: ctx.programStart });
}

/** Día local de un instante para este usuario. */
export const localDateOf = (ctx: UserContext, iso: string | Date) =>
  toDateKey(typeof iso === 'string' ? new Date(iso) : iso, ctx.tz);
