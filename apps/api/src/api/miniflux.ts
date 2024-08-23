import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import { authorize } from '../middleware/auth'
import { FeedSchema, EntrySchema, CategorySchema, UserSchema } from '../types/miniflux'
import logger from '../../../packages/utils/src/logger'

const app = new OpenAPIHono()

// Feeds group
const feedsGroup = app.group('/feeds')
feedsGroup.openapi(createRoute({
  method: 'get',
  path: '/',
  tags: ['Feeds'],
  summary: 'Get all feeds',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(FeedSchema),
        },
      },
      description: 'Successful response',
    },
  },
}), async (c) => {
  try {
    // Here you would call the Miniflux API
    const feeds = [{ id: 1, title: 'Example Feed', feed_url: 'http://example.com/feed' }]
    return c.json(feeds)
  } catch (error) {
    logger.error('Error fetching feeds', { error })
    throw error
  }
})

// Entries group
const entriesGroup = app.group('/entries')
entriesGroup.openapi(createRoute({
  method: 'get',
  path: '/',
  tags: ['Entries'],
  summary: 'Get all entries',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(EntrySchema),
        },
      },
      description: 'Successful response',
    },
  },
}), async (c) => {
  try {
    // Here you would call the Miniflux API
    const entries = [{ id: 1, title: 'Example Entry', url: 'http://example.com/entry' }]
    return c.json(entries)
  } catch (error) {
    logger.error('Error fetching entries', { error })
    throw error
  }
})

// Categories group
const categoriesGroup = app.group('/categories')
categoriesGroup.openapi(createRoute({
  method: 'get',
  path: '/',
  tags: ['Categories'],
  summary: 'Get all categories',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(CategorySchema),
        },
      },
      description: 'Successful response',
    },
  },
}), async (c) => {
  try {
    // Here you would call the Miniflux API
    const categories = [{ id: 1, title: 'Example Category' }]
    return c.json(categories)
  } catch (error) {
    logger.error('Error fetching categories', { error })
    throw error
  }
})

// Users group
const usersGroup = app.group('/users')
usersGroup.openapi(createRoute({
  method: 'get',
  path: '/',
  tags: ['Users'],
  summary: 'Get all users',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(UserSchema),
        },
      },
      description: 'Successful response',
    },
  },
}), authorize('admin'), async (c) => {
  try {
    // Here you would call the Miniflux API
    const users = [{ id: 1, username: 'admin' }]
    return c.json(users)
  } catch (error) {
    logger.error('Error fetching users', { error })
    throw error
  }
})

// Add Swagger UI
app.get('/ui', swaggerUI({ url: '/doc' }))
app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    title: 'Miniflux API Wrapper',
    version: '1.0.0',
  },
})

// Set up RPC with grouping
const rpc = createRPC(app)

const feedsRPC = rpc.namespace('feeds')
feedsRPC.use('getAll', async () => {
  // Implement the RPC method
  return [{ id: 1, title: 'Example Feed', feed_url: 'http://example.com/feed' }]
})

const entriesRPC = rpc.namespace('entries')
entriesRPC.use('getAll', async () => {
  // Implement the RPC method
  return [{ id: 1, title: 'Example Entry', url: 'http://example.com/entry' }]
})

const categoriesRPC = rpc.namespace('categories')
categoriesRPC.use('getAll', async () => {
  // Implement the RPC method
  return [{ id: 1, title: 'Example Category' }]
})

const usersRPC = rpc.namespace('users')
usersRPC.use('getAll', authorize('admin'), async () => {
  // Implement the RPC method
  return [{ id: 1, username: 'admin' }]
})

export default app
