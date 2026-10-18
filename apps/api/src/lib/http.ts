import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z, type ZodType } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Registro') => new HttpError(404, `${what} no encontrado`);

export function parse<T extends ZodType>(schema: T, data: unknown): z.output<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw new HttpError(
      400,
      r.error.issues[0]?.message ?? 'Datos inválidos',
      r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return r.data;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'JSON inválido' });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    res.status(404).json({ error: 'Registro no encontrado' });
    return;
  }
  // No se registran cuerpos de petición ni datos personales: sólo el error.
  console.error('[error]', err instanceof Error ? `${err.name}: ${err.message}` : err);
  res.status(500).json({ error: 'Error interno del servidor' });
}
