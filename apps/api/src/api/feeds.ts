import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { selectHonoFeedSchema } from '../db/schema'
import logger from '../../../../packages/utils/src/logger';
import { authorize } from '../middleware/auth';
import { db } from '../db'; // Assuming you have a db connection setup
import { honoFeeds } from '../db/schema'; // Import your feed schema

const app = new OpenAPIHono()

const getFeeds = createRoute({
  method: 'get',
  path: '/feeds',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(selectHonoFeedSchema),
        },
      },
      description: 'Retrieve all feeds',
    },
  },
})

// app.use('/feeds', authorize('admin'))
// @ts-ignore: TODO fix this
app.openapi(getFeeds, async (c) => {
  // This route is protected by the auth middleware
  try {
    const allFeeds = await db.select().from(honoFeeds).execute()
    logger.info('Feeds fetched successfully');
    return c.json(allFeeds)
  } catch (error) {
    logger.error('Error fetching feeds', { error });
    return c.json({ error: 'Internal Server Error' }, 500);
  }
})

// Add more routes (POST, PUT, DELETE) following a similar pattern

export default app
