const { Server } = require('socket.io');

let io = null;

function initSocket(httpServer, corsOrigin) {
  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    socket.on('disconnect', () => {});
  });

  return io;
}

const noopIo = { emit: () => {} };

// In contexts where the socket server was never started (unit/integration
// tests hitting the Express app directly via supertest, for example), return
// a no-op emitter instead of throwing so REST endpoints still work standalone.
function getIo() {
  return io || noopIo;
}

// Event names, centralized so client and server agree on a single source of truth.
const EVENTS = {
  STOCK_UPDATE: 'stock:update',
  DROP_CREATED: 'drop:created',
  PURCHASE_COMPLETED: 'purchase:completed',
  RESERVATION_EXPIRED: 'reservation:expired',
};

module.exports = { initSocket, getIo, EVENTS };
