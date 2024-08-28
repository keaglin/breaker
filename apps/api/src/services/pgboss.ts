import PgBoss from 'pg-boss';
import logger from '@/packages/utils/src/logger';
import { processEntry } from './entry-processor';
// import { updateEntryWithSummary } from './entry-updater';

let boss: PgBoss;

// This function sets up the worker to process queued entries
export async function setupEntryProcessor() {
  const boss = new PgBoss(process.env.DATABASE_URL as string);

  boss.on('error', (error) =>
    logger.error('PgBoss error:', error);
  );
  await boss.start();

  const queue = 'process-entry';

  await boss.createQueue(queue);

  const id = await boss.send(queue, { entryId: '1', content: 'test' });
  logger.info(`created job with id: ${id} in queue: ${queue}`);


  await boss.work<{ entryId: string; content: string }>(
    queue,
    async (job) => {
      try {
        const { entryId, content } = job.data;
        logger.info(`Processing job ${job.id} for entry ${entryId}`);

        // const summary = await processEntry(entryId, content);

        // TODO: Implement this function
        // await updateEntryWithSummary(entryId, summary);

        logger.info(`Completed processing job ${job.id}`);
        return { success: true, summary: 'test' };
      } catch (error) {
        logger.error(`Error processing job ${job.id}:`, error);
        throw error; // This will mark the job as failed in pg-boss
      }
    },
    {
      teamSize: 5,
      teamConcurrency: 1000,
    }
  );
}


export async function initializePgBoss() {
  boss = new PgBoss(process.env.DATABASE_URL as string);

  boss.on('error', error => logger.error('PgBoss error:', error));

  await boss.start();
  logger.info('PgBoss initialized and started');

  // Set up the work handler
  await boss.work<{ entryId: string; content: string }>(
    'process-entry',
    async (job) => {
      try {
        const { entryId, content } = job.data;
        logger.info(`Processing job ${job.id} for entry ${entryId}`);

        const summary = await processEntry(entryId, content);

        // await updateEntryWithSummary(entryId, summary);

        logger.info(`Completed processing job ${job.id}`);
        return { success: true, summary };
      } catch (error) {
        logger.error(`Error processing job ${job.id}:`, error);
        throw error;
      }
    },
    {
      teamSize: 5,
      teamConcurrency: 1000,
    }
  );

  logger.info('Entry processor work handler set up');
}

export async function queueEntryForProcessing(entryId: string, content: string) {
  const jobId = await boss.send('process-entry', { entryId, content });
  logger.info(`Queued job ${jobId} for entry ${entryId}`);
  return jobId;
}

export async function processNewEntries(entries: any[]) {
  for (const entry of entries) {
    await queueEntryForProcessing(entry.id, entry.content);
  }
}


