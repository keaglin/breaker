import logger from "@/packages/utils/src/logger";

export const pgbossConfig = {
  connectionString: process.env.DATABASE_URL as string,
  // ULID configuration
  // uuid: () => ulid(),
  // helloPubsub: {
  //   idColumnType: 'text'
  // },

  // Queue options
  archiveCompletedAfterSeconds: 60 * 60 * 24, // 1 day
  archiveFailedAfterSeconds: 60 * 60 * 24 * 7, // 1 week

  // Scheduling options
  clockMonitorIntervalSeconds: 60, // Check for clock skew every minute
  timeZone: 'UTC', // Adjust if needed

  // Maintenance options
  maintenanceIntervalSeconds: 60, // Run maintenance every minute

  // Expiration options
  expireInSeconds: 30 * 60, // Jobs expire after 30 minutes if not completed

  // Retention options
  retentionDays: 30, // Keep completed jobs for 30 days

  // Retry options
  retryLimit: 5, // Retry failed jobs 5 times
  retryDelay: 30, // Wait 30 seconds between retries
  retryBackoff: true, // Use exponential backoff for retries

  // Job polling options
  newJobCheckInterval: 1000, // Check for new jobs every second

  // Additional options
  max: 10, // Maximum number of connections in the pool

  // Logging (if you want to integrate with your logging system)
  onComplete: async (job) => {
    logger.info(`Job ${job.id} (${job.name}) completed successfully`, {
      data: job.data,
      result: job.response, // The return value from your job function
      duration: job.duration
    });

    // You can perform additional actions here if needed
    // For example, update a status in your database
  },
  onFail: async (job, error) => {
    logger.error(`Job ${job.id} (${job.name}) failed`, {
      data: job.data,
      error: error.message,
      stack: error.stack,
      failedOn: job.failedOn,
      retryCount: job.retryCount
    });

    // You can perform error handling or cleanup here
    // For example, notify an error tracking service
  }
};
