/**
 * Creates all tables from the Sequelize models. Safe to re-run (uses
 * CREATE TABLE IF NOT EXISTS semantics via sync, does not drop data).
 * For a from-scratch setup you can alternatively run the raw ../schema.sql
 * directly against your Postgres instance - see README.md.
 */
require('dotenv').config();
const { sequelize } = require('../src/models');

async function run() {
  await sequelize.authenticate();
  await sequelize.sync();
  console.log('Database synced successfully.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
