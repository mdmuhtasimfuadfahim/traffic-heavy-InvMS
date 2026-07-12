const dropService = require('../services/dropService');
const { getIo, EVENTS } = require('../socket');

async function list(req, res) {
  const drops = await dropService.listDropsWithActivity();
  res.json({ drops });
}

async function create(req, res) {
  const { name, price, totalStock, startsAt } = req.body;
  const drop = await dropService.createDrop({ name, price, totalStock, startsAt });

  getIo().emit(EVENTS.DROP_CREATED, { drop: drop.toPublicJSON() });

  res.status(201).json({ drop: drop.toPublicJSON() });
}

module.exports = { list, create };
