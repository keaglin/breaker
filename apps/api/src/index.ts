import { OpenAPIHono } from '@hono/zod-openapi'
import { sentry } from '@hono/sentry'
import { serve } from 'bun';
import logger from '../../../packages/utils/src/logger';
import { entries, feeds } from './db/schema';
import { db } from './db';
import { minifluxClient } from './services/miniflux/client';
import { initializePgBoss, shutdownPgBoss } from './pgboss/client';
import { desc } from 'drizzle-orm';

const app = new OpenAPIHono()

app.use('*', sentry({
  dsn: process.env.SENTRY_DSN
}))

// Global middleware
app.use('*', async (c, next) => {
  logger.info(`Request received: ${c.req.method} ${c.req.url}`)
  await next()
  logger.info(`Response sent: ${c.res.status} ${c.res.statusText}`)
})

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

app.post('/api/refresh-feeds', async (c) => {
  try {
    // Get the most recently fetched feed ID from the database
    const lastFetchedFeed = await db.select({ id: feeds.minifluxId })
      .from(feeds)
      .orderBy(desc(feeds.minifluxId))
      .limit(1)
      .execute();

    const lastFeedId = lastFetchedFeed[0]?.id || 0;
    logger.info(`Most recently fetched feed ID: ${lastFeedId}`);

    // Use this ID to refresh feeds newer than this one
    await minifluxClient.refreshFeed(lastFeedId);
    return c.json({ message: 'All feeds refreshed successfully' }, 200);
  } catch (error) {
    return c.json({ error: 'Failed to refresh feeds' }, 500);
  }
});

app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    title: 'RSS API',
    version: '1.0.0',
  },
})


const port = 3000;
console.log(`Server is running on http://localhost:${port}`);

export type AppType = typeof app

async function startServer() {
  await initializePgBoss()
  serve({
    fetch: app.fetch,
    port: port,
  });
}

async function stopServer() {
  await shutdownPgBoss()
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully.');
  await stopServer();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully.');
  await stopServer();
  process.exit(0);
});

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

