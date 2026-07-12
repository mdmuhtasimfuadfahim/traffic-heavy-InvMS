const reservationService = require('../services/reservationService');
const { getIo, EVENTS } = require('../socket');
const { ValidationError } = require('../utils/errors');

async function reserve(req, res) {
  const { dropId } = req.params;
  const { userId } = req.body;

  if (!userId) throw new ValidationError('userId is required');

  const { reservation, availableStock } = await reservationService.reserveItem({
    dropId,
    userId,
  });

  getIo().emit(EVENTS.STOCK_UPDATE, { dropId, availableStock });

  res.status(201).json({
    reservation: {
      id: reservation.id,
      dropId: reservation.dropId,
      userId: reservation.userId,
      status: reservation.status,
      expiresAt: reservation.expiresAt,
    },
    availableStock,
  });
}

async function purchase(req, res) {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) throw new ValidationError('userId is required');

  const { purchase: purchaseRecord, username } = await reservationService.purchaseReservation({
    reservationId: id,
    userId,
  });

  getIo().emit(EVENTS.PURCHASE_COMPLETED, {
    dropId: purchaseRecord.dropId,
    purchase: {
      username,
      purchasedAt: purchaseRecord.purchasedAt,
      price: purchaseRecord.price,
    },
  });

  res.status(201).json({ purchase: purchaseRecord });
}

async function cancel(req, res) {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) throw new ValidationError('userId is required');

  const { dropId, availableStock } = await reservationService.cancelReservation({
    reservationId: id,
    userId,
  });

  getIo().emit(EVENTS.STOCK_UPDATE, { dropId, availableStock });

  res.json({ dropId, availableStock });
}

module.exports = { reserve, purchase, cancel };
