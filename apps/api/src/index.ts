import { OpenAPIHono } from '@hono/zod-openapi'
import { sentry } from '@hono/sentry'
import { serve } from 'bun';
import logger from '../../../packages/utils/src/logger';
// Import and combine routes from /src/api
import feedsRouter from './api/feeds'
import { syncWithMiniflux } from './services/miniflux/minifluxSync';
// import categoriesRouter from './api/categories'
// import entriesRouter from './api/entries'

const app = new OpenAPIHono()

app.use('*', sentry({
  dsn: process.env.SENTRY_DSN
}))

app.onError((err, c) => {
  logger.error('Unhandled error', { error: err });
  return c.json({ error: 'Internal Server Error' }, 500);
})


app.route('/api', feedsRouter)
// app.route('/api', categoriesRouter)
// app.route('/api', entriesRouter)

app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    title: 'RSS API',
    version: '1.0.0',
  },
})

function syncJob() {
  syncWithMiniflux().catch(error => logger.error('Sync error:', error));
}

// Run immediately
syncJob();

// Then set up the interval
setInterval(syncJob, 600000); // 10 minutes in milliseconds

const port = 3000;
console.log(`Server is running on http://localhost:${port}`);

export type AppType = typeof app

serve({
  fetch: app.fetch,
  port: port,
});
