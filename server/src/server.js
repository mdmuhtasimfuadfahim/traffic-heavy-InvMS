require('dotenv').config();
const http = require('http');
const createApp = require('./app');
const { sequelize } = require('./models');
const { initSocket, EVENTS } = require('./socket');
const { startScheduler } = require('./services/scheduler');

const PORT = process.env.PORT || 8977;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5601';

async function main() {
  await sequelize.authenticate();
  console.log('Database connection established.');

  const app = createApp({ corsOrigin: CLIENT_URL });
  const httpServer = http.createServer(app);
  const io = initSocket(httpServer, CLIENT_URL);

  // Any reservation reclaimed by the expiration timer or the backup sweep
  // broadcasts a stock update to every connected client.
  startScheduler((result) => {
    io.emit(EVENTS.STOCK_UPDATE, { dropId: result.dropId, availableStock: result.availableStock });
    io.emit(EVENTS.RESERVATION_EXPIRED, { reservationId: result.reservationId, dropId: result.dropId });
  });

  httpServer.listen(PORT, () => {
    console.log(`API + WebSocket server listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
