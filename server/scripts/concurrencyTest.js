/**
 * Fires N simultaneous reservation requests (from N different users) against
 * a drop with exactly 1 unit of stock, then asserts that exactly one of them
 * succeeded. This is the automated version of the assessment's requirement:
 * "If 100 users click Reserve at the exact same millisecond for the last 1
 * item, only 1 user should succeed."
 *
 * Usage:
 *   npm run test:concurrency
 *   API_URL=http://localhost:8977 CONCURRENCY=200 npm run test:concurrency
 *
 * Requires the server to already be running (npm run dev / npm start).
 */
const API_URL = process.env.API_URL || 'http://localhost:8977';
const CONCURRENCY = Number(process.env.CONCURRENCY) || 100;

async function createUser(i) {
  const res = await fetch(`${API_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `race_tester_${i}_${Date.now()}` }),
  });
  const body = await res.json();
  return body.user.id;
}

async function createDrop() {
  const res = await fetch(`${API_URL}/api/drops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Concurrency Test Drop ${Date.now()}`,
      price: 99.99,
      totalStock: 1,
    }),
  });
  const body = await res.json();
  return body.drop.id;
}

async function reserve(dropId, userId) {
  const res = await fetch(`${API_URL}/api/drops/${dropId}/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return { status: res.status, body: await res.json() };
}

async function main() {
  console.log(`Creating a drop with 1 unit of stock, and ${CONCURRENCY} distinct users...`);
  const dropId = await createDrop();
  const userIds = await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, i) => createUser(i))
  );

  console.log(`Firing ${CONCURRENCY} concurrent reservation requests at drop ${dropId}...`);
  const start = Date.now();
  const results = await Promise.all(userIds.map((userId) => reserve(dropId, userId)));
  const elapsed = Date.now() - start;

  const successes = results.filter((r) => r.status === 201);
  const conflicts = results.filter((r) => r.status === 409);
  const other = results.filter((r) => r.status !== 201 && r.status !== 409);

  console.log(`\nCompleted in ${elapsed}ms`);
  console.log(`  Successful reservations: ${successes.length}`);
  console.log(`  Sold-out conflicts:      ${conflicts.length}`);
  console.log(`  Unexpected responses:    ${other.length}`);

  if (other.length > 0) {
    console.log('Unexpected response bodies:', other.map((r) => r.body));
  }

  if (successes.length === 1 && conflicts.length === CONCURRENCY - 1) {
    console.log('\nPASS: exactly one reservation succeeded, no overselling occurred.');
    process.exit(0);
  } else {
    console.log('\nFAIL: expected exactly 1 success and the rest conflicts.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Concurrency test errored:', err);
  process.exit(1);
});
