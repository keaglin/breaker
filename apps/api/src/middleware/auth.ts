import type { Context } from 'hono'
import logger from '../../../../packages/utils/src/logger';

export const authorize = (requiredRole: string) => async (c: Context, next: () => Promise<void>) => {
  const user = c.get('jwtPayload')
  if (user.role !== requiredRole) {
    logger.warn('Unauthorized access attempt');
    return c.json({ error: 'Unauthorized' }, 403)
  }
  await next()
}

// Which to use?
// import { Context } from 'hono'

// export async function authMiddleware(c: Context, next: () => Promise<void>) {
//   const token = c.req.header('Authorization');

//   if (!token) {
//     return c.json({ error: 'Unauthorized' }, 401);
//   }

//   // Verify the token here (e.g., with JWT)
//   // If valid, you might want to attach the user to the context
//   // c.set('user', decodedUser);

//   await next()
// }
