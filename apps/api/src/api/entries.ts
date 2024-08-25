import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { selectHonoEntrySchema } from '../db/schema' // You'll need to create this
import logger from '../../../../packages/utils/src/logger';
import { authorize } from '../middleware/auth';
import { db } from '../db';
import { honoEntries } from '../db/schema'; // Import your entry schema

const app = new OpenAPIHono()

const getEntries = createRoute({
  method: 'get',
  path: '/entries',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(selectHonoEntrySchema),
        },
      },
      description: 'Retrieve all entries',
    },
  },
})

// app.use('/entries', authorize('admin'))


app.openapi(getEntries, async (c) => {
  try {
    const allEntries = await db.select().from(honoEntries).execute()
    logger.info('Entries fetched successfully');
    return c.json(allEntries)
  } catch (error) {
    logger.error('Error fetching entries', { error });
    return c.json({ error: 'Internal Server Error' }, 500);
  }
})

export default app
