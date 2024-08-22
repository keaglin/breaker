import { Hono } from 'hono'
import { sentry } from '@hono/sentry'
import { serve } from 'bun';

const app = new Hono()

app.use('*', sentry({
  dsn: process.env.SENTRY_DSN
}
))
app.get('/', (c) => c.text('Hello from Bun/Hono'))

const port = 3000;
console.log(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port: port,
});
