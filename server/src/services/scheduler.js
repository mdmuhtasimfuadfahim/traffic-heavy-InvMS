const reservationService = require('./reservationService');

const SWEEP_INTERVAL_MS = 15 * 1000;

/**
 * Starts the backup sweep interval and re-arms timers for reservations that
 * were already active when the process booted. `onExpire` is called with
 * { dropId, availableStock, reservationId } for each reservation reclaimed,
 * so the caller (socket.js) can broadcast the updated stock count.
 */
function startScheduler(onExpire) {
  reservationService.rearmActiveReservations(onExpire).catch((err) => {
    console.error('Failed to rearm active reservations on boot:', err.message);
  });

  const interval = setInterval(() => {
    reservationService.sweepExpiredReservations(onExpire).catch((err) => {
      console.error('Sweep error:', err.message);
    });
  }, SWEEP_INTERVAL_MS);

  return () => clearInterval(interval);
}

module.exports = { startScheduler };
