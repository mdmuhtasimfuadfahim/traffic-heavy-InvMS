const { Transaction, Op } = require('sequelize');
const sequelize = require('../config/database');
const { Reservation, Drop, Purchase, User } = require('../models');
const { NotFoundError, ConflictError, ForbiddenError } = require('../utils/errors');

const RESERVATION_WINDOW_MS = (Number(process.env.RESERVATION_WINDOW_SECONDS) || 60) * 1000;

// In-memory map of active expiration timers, keyed by reservation id.
// This is a single-process optimization only: the `sweepExpiredReservations`
// backup job below is what actually guarantees correctness (see README,
// "Architecture Choice" section) in case the process restarts and loses timers.
const timers = new Map();

function scheduleExpiration(reservationId, onExpire) {
  const timer = setTimeout(async () => {
    timers.delete(reservationId);
    try {
      const result = await expireReservation(reservationId);
      if (result && onExpire) onExpire(result);
    } catch (err) {
      console.error(`Failed to expire reservation ${reservationId}:`, err.message);
    }
  }, RESERVATION_WINDOW_MS);
  timers.set(reservationId, timer);
}

function clearScheduledExpiration(reservationId) {
  const timer = timers.get(reservationId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(reservationId);
  }
}

/**
 * ATOMIC RESERVATION.
 *
 * Overselling is prevented with a single conditional UPDATE, expressed via
 * Sequelize's Model.update() with a `WHERE available_stock > 0` guard and
 * `returning: true`:
 *
 *   UPDATE drops SET available_stock = available_stock - 1
 *   WHERE id = :dropId AND available_stock > 0
 *   RETURNING *
 *
 * Postgres takes an implicit row lock for the duration of an UPDATE, so if
 * 100 requests hit this at the same millisecond for the same drop, Postgres
 * serializes them at the row level: each UPDATE runs to completion before the
 * next one starts. Every request after the one that brings available_stock to
 * 0 will match zero rows (because of the `available_stock > 0` guard) and
 * affectedCount will be 0 - that request is told "sold out", without ever
 * needing an application-level lock, mutex, or SELECT ... FOR UPDATE.
 *
 * The whole thing runs inside a transaction together with the Reservation
 * insert so a failure to create the reservation row rolls back the decrement.
 */
async function reserveItem({ dropId, userId }) {
  const result = await sequelize.transaction(async (t) => {
    const [affectedCount, affectedRows] = await Drop.update(
      { availableStock: sequelize.literal('available_stock - 1') },
      {
        where: { id: dropId, availableStock: { [Op.gt]: 0 } },
        transaction: t,
        returning: true,
      }
    );

    if (affectedCount === 0) {
      // Either the drop doesn't exist, or it's sold out.
      const exists = await Drop.findByPk(dropId, { transaction: t });
      if (!exists) throw new NotFoundError('Drop not found');
      throw new ConflictError('Sold out - no available stock');
    }

    const expiresAt = new Date(Date.now() + RESERVATION_WINDOW_MS);
    const created = await Reservation.create(
      { dropId, userId, status: 'active', expiresAt },
      { transaction: t }
    );

    return { reservation: created, availableStock: affectedRows[0].availableStock };
  });

  scheduleExpiration(result.reservation.id);

  return result;
}

/**
 * Expire a single reservation if it is still active and past its window.
 * Locks the reservation row (SELECT ... FOR UPDATE) so this can never race
 * against a concurrent purchase() call for the same reservation - whichever
 * transaction acquires the lock first wins, and the other sees the updated
 * status and becomes a no-op.
 */
async function expireReservation(reservationId, { force = false } = {}) {
  return sequelize.transaction(async (t) => {
    const reservation = await Reservation.findByPk(reservationId, {
      transaction: t,
      lock: Transaction.LOCK.UPDATE,
    });

    if (!reservation || reservation.status !== 'active') return null;
    if (!force && new Date(reservation.expiresAt) > new Date()) return null;

    reservation.status = 'expired';
    await reservation.save({ transaction: t });

    const [, affectedRows] = await Drop.update(
      { availableStock: sequelize.literal('available_stock + 1') },
      { where: { id: reservation.dropId }, transaction: t, returning: true }
    );

    return {
      dropId: reservation.dropId,
      availableStock: affectedRows[0].availableStock,
      reservationId,
    };
  });
}

/**
 * Complete a purchase for a reservation the user currently holds.
 * Stock was already decremented at reservation time, so a purchase does not
 * touch available_stock again - it just converts the reservation into a
 * permanent Purchase record. If the reservation already expired (timer
 * hasn't fired yet, but the window has passed), we expire it here instead of
 * allowing the purchase, and give the unit back to available stock.
 */
async function purchaseReservation({ reservationId, userId }) {
  const result = await sequelize.transaction(async (t) => {
    const reservation = await Reservation.findByPk(reservationId, {
      transaction: t,
      lock: Transaction.LOCK.UPDATE,
    });

    if (!reservation) throw new NotFoundError('Reservation not found');
    if (reservation.userId !== userId) {
      throw new ForbiddenError('This reservation does not belong to you');
    }

    if (reservation.status !== 'active') {
      throw new ConflictError(`Reservation is ${reservation.status}, not active`);
    }

    if (new Date(reservation.expiresAt) <= new Date()) {
      reservation.status = 'expired';
      await reservation.save({ transaction: t });
      await Drop.update(
        { availableStock: sequelize.literal('available_stock + 1') },
        { where: { id: reservation.dropId }, transaction: t }
      );
      throw new ConflictError('Reservation window expired - please reserve again');
    }

    reservation.status = 'completed';
    await reservation.save({ transaction: t });

    const drop = await Drop.findByPk(reservation.dropId, { transaction: t });
    const purchase = await Purchase.create(
      {
        dropId: reservation.dropId,
        userId,
        reservationId,
        price: drop.price,
      },
      { transaction: t }
    );

    const user = await User.findByPk(userId, { transaction: t });

    return { purchase, drop, username: user.username };
  });

  clearScheduledExpiration(reservationId);
  return result;
}

async function cancelReservation({ reservationId, userId }) {
  const result = await sequelize.transaction(async (t) => {
    const reservation = await Reservation.findByPk(reservationId, {
      transaction: t,
      lock: Transaction.LOCK.UPDATE,
    });

    if (!reservation) throw new NotFoundError('Reservation not found');
    if (reservation.userId !== userId) throw new ForbiddenError('Not your reservation');
    if (reservation.status !== 'active') {
      throw new ConflictError(`Reservation is ${reservation.status}, not active`);
    }

    reservation.status = 'cancelled';
    await reservation.save({ transaction: t });

    const [, affectedRows] = await Drop.update(
      { availableStock: sequelize.literal('available_stock + 1') },
      { where: { id: reservation.dropId }, transaction: t, returning: true }
    );

    return { dropId: reservation.dropId, availableStock: affectedRows[0].availableStock };
  });

  clearScheduledExpiration(reservationId);
  return result;
}

/**
 * Backup sweep: catches reservations whose expiry timer was lost because the
 * server process restarted. Safe to run repeatedly and concurrently with the
 * per-reservation timers because expireReservation() is idempotent (it only
 * acts on reservations still in 'active' status).
 */
async function sweepExpiredReservations(onExpire) {
  const expired = await Reservation.findAll({
    where: { status: 'active' },
    attributes: ['id', 'expiresAt'],
  });

  const now = Date.now();
  const due = expired.filter((r) => new Date(r.expiresAt).getTime() <= now);

  for (const r of due) {
    try {
      const result = await expireReservation(r.id);
      if (result && onExpire) onExpire(result);
    } catch (err) {
      console.error(`Sweep failed to expire reservation ${r.id}:`, err.message);
    }
  }

  return due.length;
}

/**
 * On boot, re-arm in-memory timers for any reservation that is still active
 * (e.g. process restarted mid-flight) so we don't have to wait for the sweep
 * interval to reclaim their stock.
 */
async function rearmActiveReservations(onExpire) {
  const active = await Reservation.findAll({ where: { status: 'active' } });
  const now = Date.now();

  for (const r of active) {
    const msLeft = new Date(r.expiresAt).getTime() - now;
    if (msLeft <= 0) {
      const result = await expireReservation(r.id);
      if (result && onExpire) onExpire(result);
    } else {
      const timer = setTimeout(async () => {
        timers.delete(r.id);
        const result = await expireReservation(r.id);
        if (result && onExpire) onExpire(result);
      }, msLeft);
      timers.set(r.id, timer);
    }
  }
}

module.exports = {
  reserveItem,
  purchaseReservation,
  cancelReservation,
  expireReservation,
  sweepExpiredReservations,
  rearmActiveReservations,
  RESERVATION_WINDOW_MS,
};
