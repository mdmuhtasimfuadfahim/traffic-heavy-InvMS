const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const { Drop } = require('../models');
const { ValidationError } = require('../utils/errors');

const RECENT_PURCHASERS_LIMIT = 3;

/**
 * Create a new "Merch Drop". Stock is initialized to totalStock and is fully
 * available immediately (availableStock === totalStock) until reservations
 * start consuming it.
 */
async function createDrop({ name, price, totalStock, startsAt }) {
  if (!name || typeof name !== 'string') {
    throw new ValidationError('name is required');
  }
  if (price === undefined || Number.isNaN(Number(price)) || Number(price) < 0) {
    throw new ValidationError('price must be a non-negative number');
  }
  if (!Number.isInteger(totalStock) || totalStock < 0) {
    throw new ValidationError('totalStock must be a non-negative integer');
  }

  const drop = await Drop.create({
    name,
    price,
    totalStock,
    availableStock: totalStock,
    startsAt: startsAt ? new Date(startsAt) : new Date(),
  });

  return drop;
}

/**
 * List all drops with their live available stock plus the 3 most recent
 * successful purchasers, nested per-drop, in a single round trip.
 */
async function listDropsWithActivity() {
  const drops = await Drop.findAll({ order: [['startsAt', 'DESC']] });

  if (drops.length === 0) return [];

  // Fetch recent purchases for all drops in one query, then group in memory.
  // (Avoids N+1 queries while still giving each drop only its own top 3.)
  const purchases = await sequelize.query(
    `
    SELECT p.drop_id, p.purchased_at, p.price, u.username
    FROM purchases p
    JOIN users u ON u.id = p.user_id
    WHERE p.drop_id IN (:dropIds)
    ORDER BY p.purchased_at DESC
    `,
    {
      replacements: { dropIds: drops.map((d) => d.id) },
      type: QueryTypes.SELECT,
    }
  );

  const purchasesByDrop = new Map();
  for (const purchase of purchases) {
    const list = purchasesByDrop.get(purchase.drop_id) || [];
    if (list.length < RECENT_PURCHASERS_LIMIT) {
      list.push({
        username: purchase.username,
        purchasedAt: purchase.purchased_at,
        price: purchase.price,
      });
    }
    purchasesByDrop.set(purchase.drop_id, list);
  }

  return drops.map((drop) => ({
    ...drop.toPublicJSON(),
    recentPurchasers: purchasesByDrop.get(drop.id) || [],
  }));
}

async function getDropOr404(dropId) {
  const drop = await Drop.findByPk(dropId);
  return drop;
}

module.exports = {
  createDrop,
  listDropsWithActivity,
  getDropOr404,
  RECENT_PURCHASERS_LIMIT,
};
