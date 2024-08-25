import { OpenAPIHono } from '@hono/zod-openapi'
import { sentry } from '@hono/sentry'
import { serve } from 'bun';
import logger from '../../../packages/utils/src/logger';
// Import and combine routes from /src/api
import feedsRouter from './api/feeds'
import { syncWithMiniflux } from './services/miniflux/old/minifluxSync';
// import categoriesRouter from './api/categories'
import entriesRouter from './api/entries'
import { entries, feeds } from './db/schema';
import { db } from './db';
import { startSyncService, syncMinifluxData } from './services/miniflux/sync';
import { MinifluxClient } from './services/miniflux/client';
import { storeProcessedData } from './services/miniflux/storeData';

const app = new OpenAPIHono()

app.use('*', sentry({
  dsn: process.env.SENTRY_DSN
}))

// Global middleware
// app.use('*', async (c, next) => {
//   logger.info(`Request received: ${c.req.method} ${c.req.url}`)
//   await next()
//   logger.info(`Response sent: ${c.res.status} ${c.res.statusText}`)
// })

app.onError((err, c) => {
  logger.error('Unhandled error', { error: err });
  return c.json({ error: 'Internal Server Error' }, 500);
})


// app.route('/api', feedsRouter)
// app.route('/api', entriesRouter)
// app.route('/api', categoriesRouter)
// app.route('/api', entriesRouter)

app.get('/api/feeds', async (c) => {
  const feedsFromDb = await db.select().from(feeds).execute()
  return c.json(feedsFromDb)
})

app.get('/api/entries', async (c) => {
  const entriesFromDb = await db.select().from(entries).execute()
  return c.json(entriesFromDb)
})

app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    title: 'RSS API',
    version: '1.0.0',
  },
})


// startSyncService(10)

// Use this to seed the database with all the data from miniflux
// const minifluxClient = new MinifluxClient(process.env.MINIFLUX_API_URL as string, process.env.MINIFLUX_API_KEY as string);
// minifluxClient.seedDatabase().then((data) => {
//   console.log(`Seeded database with ${data.feeds.length} feeds and ${data.entries.length} entries`);
//   storeProcessedData(data.feeds, data.entries);
// }).catch((error: unknown) => {
//   console.error('Failed to seed database', error);
// });
const port = 3000;
console.log(`Server is running on http://localhost:${port}`);

export type AppType = typeof app


serve({
  fetch: app.fetch,
  port: port,
});
