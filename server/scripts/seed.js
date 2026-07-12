/**
 * Seeds a couple of demo users and merch drops, including one with a single
 * unit of stock left - handy for demoing/testing the "last item" race
 * condition described in the assessment.
 */
require('dotenv').config();
const { sequelize, User, Drop } = require('../src/models');

async function run() {
  await sequelize.authenticate();
  await sequelize.sync();

  const usernames = ['sneakerhead_99', 'kickscollector', 'retro_jordans', 'hypebeast_88'];
  for (const username of usernames) {
    await User.findOrCreate({ where: { username }, defaults: { username } });
  }

  await Drop.findOrCreate({
    where: { name: 'Air Jordan 1 - Chicago Reimagined' },
    defaults: {
      name: 'Air Jordan 1 - Chicago Reimagined',
      price: 210.0,
      totalStock: 25,
      availableStock: 25,
      startsAt: new Date(),
    },
  });

  await Drop.findOrCreate({
    where: { name: 'Yeezy Boost 350 - Last Pair' },
    defaults: {
      name: 'Yeezy Boost 350 - Last Pair',
      price: 230.0,
      totalStock: 1,
      availableStock: 1,
      startsAt: new Date(),
    },
  });

  await Drop.findOrCreate({
    where: { name: 'New Balance 550 - Coming Soon' },
    defaults: {
      name: 'New Balance 550 - Coming Soon',
      price: 150.0,
      totalStock: 40,
      availableStock: 40,
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // starts tomorrow
    },
  });

  console.log('Seed complete.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
