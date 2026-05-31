import { Prisma } from '@prisma/client';

/**
 * Checks if the given error is a Prisma P2002 Unique Constraint violation.
 */
export function isUniqueConstraintError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === 'P2002';
  }
  return Boolean(
    err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as any).code === 'P2002'
  );
}
