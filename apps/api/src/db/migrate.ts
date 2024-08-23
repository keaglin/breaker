import { migrationClient } from './index';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'path';
import { fileURLToPath } from 'url';

async function main() {
  console.log('Start migration! 🍀')
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const migrationsFolder = path.join(__dirname, '..', '..', 'drizzle');

  try {
    await migrate(drizzle(migrationClient), { migrationsFolder });
  } catch (error) {
    console.error('Migration failed! 💥', error);
  } finally {
    console.log('Migration finished! 🍀')
  }
  process.exit(0)
}

main()
