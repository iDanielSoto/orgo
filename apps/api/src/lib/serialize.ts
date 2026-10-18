import type { Prisma } from '@prisma/client';
import { utcToDateKey } from '@forma/core';

export const num = (d: Prisma.Decimal | number | null | undefined): number | null =>
  d === null || d === undefined ? null : Number(d);

export const numReq = (d: Prisma.Decimal | number): number => Number(d);

export const dateKey = (d: Date): string => utcToDateKey(d);
