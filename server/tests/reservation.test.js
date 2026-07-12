/**
 * Integration tests against a real Postgres database (set DATABASE_URL to a
 * disposable test database before running - see README.md). These exercise
 * the exact two things the assessment cares about most: no overselling under
 * concurrency, and automatic stock recovery after the reservation window.
 */
const request = require('supertest');
const createApp = require('../src/app');
const { sequelize, Drop } = require('../src/models');
const reservationService = require('../src/services/reservationService');

const app = createApp({ corsOrigin: '*' });

async function createUser(username) {
  const res = await request(app).post('/api/users').send({ username });
  return res.body.user.id;
}

async function createDrop(totalStock) {
  const res = await request(app)
    .post('/api/drops')
    .send({ name: `Test Drop ${Date.now()}-${Math.random()}`, price: 100, totalStock });
  return res.body.drop.id;
}

beforeAll(async () => {
  await sequelize.authenticate();
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('Atomic reservations (no overselling)', () => {
  it('allows exactly one success when many users race for the last unit', async () => {
    const dropId = await createDrop(1);
    const userIds = await Promise.all(
      Array.from({ length: 25 }, (_, i) => createUser(`racer_${i}_${Date.now()}_${Math.random()}`))
    );

    const responses = await Promise.all(
      userIds.map((userId) =>
        request(app).post(`/api/drops/${dropId}/reservations`).send({ userId })
      )
    );

    const successes = responses.filter((r) => r.status === 201);
    const conflicts = responses.filter((r) => r.status === 409);

    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(24);

    const drop = await Drop.findByPk(dropId);
    expect(drop.availableStock).toBe(0);
  });

  it('lets N users each reserve one of N available units, with no double counting', async () => {
    const dropId = await createDrop(10);
    const userIds = await Promise.all(
      Array.from({ length: 10 }, (_, i) => createUser(`buyer_${i}_${Date.now()}_${Math.random()}`))
    );

    const responses = await Promise.all(
      userIds.map((userId) =>
        request(app).post(`/api/drops/${dropId}/reservations`).send({ userId })
      )
    );

    expect(responses.every((r) => r.status === 201)).toBe(true);

    const drop = await Drop.findByPk(dropId);
    expect(drop.availableStock).toBe(0);
  });
});

describe('Stock recovery on expiration', () => {
  it('returns the unit to available stock once the reservation expires', async () => {
    const dropId = await createDrop(1);
    const userId = await createUser(`expirer_${Date.now()}`);

    const reserveRes = await request(app)
      .post(`/api/drops/${dropId}/reservations`)
      .send({ userId });
    expect(reserveRes.status).toBe(201);

    let drop = await Drop.findByPk(dropId);
    expect(drop.availableStock).toBe(0);

    // Force-expire (bypasses the real 60s wait; the scheduler test below
    // is what proves the timer is wired up correctly).
    const result = await reservationService.expireReservation(reserveRes.body.reservation.id, {
      force: true,
    });
    expect(result.availableStock).toBe(1);

    drop = await Drop.findByPk(dropId);
    expect(drop.availableStock).toBe(1);
  });

  it('actually auto-expires via the real timer after RESERVATION_WINDOW_SECONDS', async () => {
    const dropId = await createDrop(1);
    const userId = await createUser(`timer_${Date.now()}`);

    const reserveRes = await request(app)
      .post(`/api/drops/${dropId}/reservations`)
      .send({ userId });
    expect(reserveRes.status).toBe(201);

    // RESERVATION_WINDOW_SECONDS=1 in test env (see tests/setup.js)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const drop = await Drop.findByPk(dropId);
    expect(drop.availableStock).toBe(1);
  });
});

describe('Purchase flow', () => {
  it('only allows the reserving user to complete the purchase', async () => {
    const dropId = await createDrop(1);
    const ownerId = await createUser(`owner_${Date.now()}`);
    const strangerId = await createUser(`stranger_${Date.now()}`);

    const reserveRes = await request(app)
      .post(`/api/drops/${dropId}/reservations`)
      .send({ userId: ownerId });
    const reservationId = reserveRes.body.reservation.id;

    const strangerAttempt = await request(app)
      .post(`/api/reservations/${reservationId}/purchase`)
      .send({ userId: strangerId });
    expect(strangerAttempt.status).toBe(403);

    const ownerAttempt = await request(app)
      .post(`/api/reservations/${reservationId}/purchase`)
      .send({ userId: ownerId });
    expect(ownerAttempt.status).toBe(201);

    // Stock stays permanently decremented after purchase.
    const drop = await Drop.findByPk(dropId);
    expect(drop.availableStock).toBe(0);
  });

  it('exposes the 3 most recent purchasers nested on the drop', async () => {
    const dropId = await createDrop(5);
    const usernames = ['p1', 'p2', 'p3', 'p4'].map((u) => `${u}_${Date.now()}`);

    for (const username of usernames) {
      const userId = await createUser(username);
      const reserveRes = await request(app)
        .post(`/api/drops/${dropId}/reservations`)
        .send({ userId });
      await request(app)
        .post(`/api/reservations/${reserveRes.body.reservation.id}/purchase`)
        .send({ userId });
    }

    const listRes = await request(app).get('/api/drops');
    const drop = listRes.body.drops.find((d) => d.id === dropId);

    expect(drop.recentPurchasers).toHaveLength(3);
    // Most recent (p4) first.
    expect(drop.recentPurchasers[0].username).toBe(usernames[3]);
  });
});
