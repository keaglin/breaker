import winston from 'winston';

const logDir = process.env.LOG_DIR || './logs';

// Custom format for file logs
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf(({ level, message, timestamp }) => {
    return JSON.stringify({ timestamp, level: level.toUpperCase(), message });
  })
);

// Custom format for console logs
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp(),
  winston.format.printf(({ level, message, timestamp }) => {
    // console.log('level type', typeof level);
    // const uppercaseLevel = level.toUpperCase();
    // console.log('uppercaseLevel type', typeof uppercaseLevel);
    // console.log('uppercaseLevel', uppercaseLevel.toString());
    return `${timestamp} ${level}: ${message}`;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'silly', // This sets the minimum log level
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    new winston.transports.File({
      filename: `${logDir}/app.log`,
      format: fileFormat,
    }),
    new winston.transports.File({ filename: `${logDir}/error.log`, level: 'error' }),
  ],
});

// Handle uncaught exceptions
logger.exceptions.handle(
  new winston.transports.File({ filename: (`${logDir}/exceptions.log`) })
);

// Handle unhandled promise rejections
logger.rejections.handle(
  new winston.transports.File({ filename: (`${logDir}/rejections.log`) })
);

// Ensure logs are flushed on exit
process.on('exit', () => {
  logger.end();
});

export default logger;
