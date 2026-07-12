/**
 * DESTRUCTIVE: drops and recreates every table (sequelize.sync({ force: true }))
 * then re-seeds fresh demo data. Use this to wipe out test-run data (expired
 * reservations, sold-out drops, throwaway usernames) before recording a clean
 * demo, or before a "fresh" deployment.
 *
 * Requires typing "yes" to confirm, since this permanently deletes data - if
 * DATABASE_URL happens to point at Neon in production, this really does wipe
 * production. Double check DATABASE_URL before running.
 */
require('dotenv').config();
const readline = require('readline');
const { sequelize, User, Drop } = require('../src/models');

function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function seedFreshData() {
  const usernames = ['sneakerhead_99', 'kickscollector', 'retro_jordans', 'hypebeast_88'];
  for (const username of usernames) {
    await User.findOrCreate({ where: { username }, defaults: { username } });
  }

  await Drop.create({
    name: 'Air Jordan 1 - Chicago Reimagined',
    price: 210.0,
    totalStock: 25,
    availableStock: 25,
    startsAt: new Date(),
  });

  await Drop.create({
    name: 'Yeezy Boost 350 - Last Pair',
    price: 230.0,
    totalStock: 1,
    availableStock: 1,
    startsAt: new Date(),
  });

  await Drop.create({
    name: 'New Balance 550 - Coming Soon',
    price: 150.0,
    totalStock: 40,
    availableStock: 40,
    startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
}

async function run() {
  const target = process.env.DATABASE_URL || '(not set)';
  console.log(`This will DROP AND RECREATE every table on:\n  ${target}\n`);

  const skipConfirm = process.argv.includes('--yes');
  if (!skipConfirm) {
    const answer = await confirm('Type "yes" to continue: ');
    if (answer !== 'yes') {
      console.log('Aborted - no changes made.');
      process.exit(0);
    }
  }

  await sequelize.authenticate();
  await sequelize.sync({ force: true });
  await seedFreshData();

  console.log('Database reset and re-seeded with fresh demo data.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
