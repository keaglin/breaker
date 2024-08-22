import { Hono } from 'hono'
import { sentry } from '@hono/sentry'

const app = new Hono()

app.use('*', sentry({
  dsn: process.env.SENTRY_DSN
}
))
// app.get('/', (c) => c.text('foo'))

export default app
