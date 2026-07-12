require('dotenv').config();
const http = require('http');
const createApp = require('./app');
const { sequelize } = require('./models');
const { initSocket, EVENTS } = require('./socket');
const { startScheduler } = require('./services/scheduler');
const reservationService = require('./services/reservationService');

const PORT = process.env.PORT || 8977;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5601';

async function main() {
  await sequelize.authenticate();
  console.log('Database connection established.');

  const app = createApp({ corsOrigin: CLIENT_URL });
  const httpServer = http.createServer(app);
  const io = initSocket(httpServer, CLIENT_URL);

  // Registered once, used by every path that can expire a reservation: the
  // per-reservation timer armed the moment someone reserves an item, the
  // boot-time re-arm, and the backup sweep. Any reservation reclaimed by any
  // of them broadcasts a stock update to every connected client.
  reservationService.setExpirationNotifier((result) => {
    io.emit(EVENTS.STOCK_UPDATE, { dropId: result.dropId, availableStock: result.availableStock });
    io.emit(EVENTS.RESERVATION_EXPIRED, { reservationId: result.reservationId, dropId: result.dropId });
  });

  startScheduler();

  httpServer.listen(PORT, () => {
    console.log(`API + WebSocket server listening on port ${PORT}`);
    // Printed on every boot so a CORS mismatch can be confirmed from the
    // Render logs alone, without needing to reproduce the error first -
    // compare this exact string against the browser's actual Origin header.
    console.log(`CORS: CLIENT_URL="${CLIENT_URL}"`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
