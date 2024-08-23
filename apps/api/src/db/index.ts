import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import invariant from 'tiny-invariant';


invariant(process.env.DATABASE_URL, 'DATABASE_URL is not set. Check env variables.');

// for migrations
export const migrationClient = postgres(process.env.DATABASE_URL!, { max: 1 });
// migrate(drizzle(migrationClient), ...)

// for query purposes
const queryClient = postgres(process.env.DATABASE_URL!);
export const db = drizzle(queryClient);
// await db.select().from(...)...

// could add more clients for miniflux as needed
