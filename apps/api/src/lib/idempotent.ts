import { Prisma } from '@prisma/client';
import { HttpError } from './http';

/**
 * Creación idempotente con UUID generado por el cliente: si el registro ya
 * existe y pertenece al mismo usuario, se devuelve el existente (reintento);
 * si pertenece a otro usuario, conflicto.
 */
export async function createIdempotent<T extends { userId: string }>(
  create: () => Promise<T>,
  findExisting: () => Promise<T | null>,
  userId: string,
): Promise<{ record: T; created: boolean }> {
  try {
    return { record: await create(), created: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const existing = await findExisting();
      if (existing && existing.userId === userId) return { record: existing, created: false };
      throw new HttpError(409, 'Identificador en conflicto');
    }
    throw err;
  }
}
