const reservationService = require('./reservationService');

const SWEEP_INTERVAL_MS = 15 * 1000;

/**
 * Starts the backup sweep interval and re-arms timers for reservations that
 * were already active when the process booted. Call
 * reservationService.setExpirationNotifier() before this, so every path that
 * can expire a reservation - the per-reservation timer armed in
 * reserveItem(), this re-arm, and the sweep below - broadcasts consistently.
 */
function startScheduler() {
  reservationService.rearmActiveReservations().catch((err) => {
    console.error('Failed to rearm active reservations on boot:', err.message);
  });

  const interval = setInterval(() => {
    reservationService.sweepExpiredReservations().catch((err) => {
      console.error('Sweep error:', err.message);
    });
  }, SWEEP_INTERVAL_MS);

  return () => clearInterval(interval);
}

module.exports = { startScheduler };
