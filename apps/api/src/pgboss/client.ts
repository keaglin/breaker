import PgBoss from 'pg-boss';
import logger from '@/packages/utils/src/logger';
import { pgbossConfig } from './config';
import { initializeQueues } from './initQueues';
import { MINIFLUX_SYNC_INTERVAL_MINUTES, setupMinifluxSync } from './jobs/miniflux-sync';
import { setupEntrySummarizationJobs } from './jobs/summarize-entry';
import { setupTrendAnalysisJobs } from './jobs/trend-analysis';
import { setupBackfillTrendAnalysisJobs, initializeBackfill } from './jobs/backfill-trend-analysis';
let bossInstance: PgBoss | null = null;

function createBossInstance(): PgBoss {
  const boss = new PgBoss(pgbossConfig);

  boss.on('error', error => logger.error('PgBoss error:', error));
  boss.on('wip', ([job]) => {
    const jobInfo = {
      id: job.id,
      name: job.name,
      options: job.options,
      state: job.state,
      count: job.count,
      createdOn: job.createdOn,
      lastFetchedOn: job.lastFetchedOn,
      lastJobStartedOn: job.lastJobStartedOn,
      lastJobEndedOn: job.lastJobEndedOn,
      lastJobDuration: job.lastJobDuration,
      lastError: job.lastError,
      lastErrorOn: job.lastErrorOn
    };
    console.debug(`Job in progress for worker ${job.name} (${job.id}):`, JSON.stringify(jobInfo, null, 2));
  });
  boss.on('monitor-states', (monitorStates) => {
    logger.info('PgBoss monitor states:', JSON.stringify(monitorStates, null, 2));
  });
  boss.on('stopped', () => logger.info('PgBoss stopped'));

  return boss;
}

export async function initializePgBoss() {
  try {
    if (!bossInstance) {
      bossInstance = createBossInstance();
      await bossInstance.start();
      logger.info('PgBoss initialized and started');

      await Promise.all([
        setupTrendAnalysisJobs(),
        setupEntrySummarizationJobs(),
        setupMinifluxSync(MINIFLUX_SYNC_INTERVAL_MINUTES),
        setupBackfillTrendAnalysisJobs(),
        initializeQueues()
      ]);

      logger.info('All job handlers set up');

      await initializeBackfill();
      logger.info('Backfill initialized');
    }
    return bossInstance;
  } catch (error) {
    logger.error('Error initializing PgBoss:', error);
    bossInstance = null;
    throw error;
  }
}

export async function getBossInstance(): Promise<PgBoss> {
  if (!bossInstance) {
    return initializePgBoss();
  }
  return bossInstance;
}

export async function stopBoss(): Promise<void> {
  if (bossInstance) {
    await bossInstance.stop({ graceful: true, timeout: 30000 });
    bossInstance = null;
    logger.info('PgBoss stopped and instance cleared');
  }
}

export async function shutdownPgBoss() {
  try {
    await stopBoss();
  } catch (error) {
    logger.error('Error shutting down PgBoss:', error);
  }
}
