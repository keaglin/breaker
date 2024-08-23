import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { selectHonoFeedSchema } from '../db/honoSchema'
import logger from '../../../../packages/utils/src/logger';
import { authorize } from '../middleware/auth';

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

app.use('/feeds', authorize('admin'))
// @ts-ignore: TODO fix this
app.openapi(getFeeds, async (c) => {
  // This route is protected by the auth middleware
  try {
    // Here you would fetch feeds from your database using Drizzle
    // For example:
    // const allFeeds = await db.select().from(feeds).execute()
    // return c.json(allFeeds)
    logger.info('Feeds fetched successfully');
    return c.json([]) // Placeholder
  } catch (error) {
    logger.error('Error fetching feeds', { error });
    return c.json({ error: 'Internal Server Error' }, 500);
  }
})

// Add more routes (POST, PUT, DELETE) following a similar pattern

export default app
