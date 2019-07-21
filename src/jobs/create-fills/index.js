const bluebird = require('bluebird');
const signale = require('signale');

const {
  MissingBlockError,
  UnsupportedAssetError,
  UnsupportedProtocolError,
} = require('../../errors');
const createFill = require('./create-fill');
const ensureTokenExists = require('../../tokens/ensure-token-exists');
const getUnprocessedEvents = require('./get-unprocessed-events');
const persistFill = require('./persist-fill');

const logger = signale.scope('create fills');

const createFills = async ({ batchSize, processOldestFirst }) => {
  const events = await getUnprocessedEvents(
    batchSize,
    processOldestFirst ? 1 : -1,
  );

  logger.info(`found ${events.length} events without associated fills`);

  await bluebird.mapSeries(events, async event => {
    logger.time(`create fill for event ${event.id}`);

    try {
      const fill = await createFill(event);

      if (await ensureTokenExists(fill.makerToken)) {
        logger.success(`created token: ${fill.makerToken}`);
      }

      if (await ensureTokenExists(fill.takerToken)) {
        logger.success(`created token: ${fill.takerToken}`);
      }

      await persistFill(event, fill);

      logger.timeEnd(`create fill for event ${event.id}`);
    } catch (error) {
      if (error instanceof MissingBlockError) {
        logger.warn(
          `Unable to create fill for event ${event.id} due to missing block`,
        );
      } else if (error instanceof UnsupportedAssetError) {
        logger.warn(
          `Unable to create fill for event ${event.id} due to unsupported asset`,
        );
      } else if (error instanceof UnsupportedProtocolError) {
        logger.warn(
          `Unable to create fill for event ${event.id} due to unsupported protocol`,
        );
      } else {
        throw error;
      }
    }
  });
};

module.exports = createFills;
