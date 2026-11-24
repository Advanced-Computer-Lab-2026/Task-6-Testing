// Backend tests for /api/items — THIS is the only backend file you edit.
// Run with:  npm test --workspace server
//
// tests/setup.js already starts an in-memory MongoDB and empties it after
// every test, so each test starts from a clean database.
import request from 'supertest';
import app from '../src/app.js';

// Helper: registers a user and returns their JWT.
// Use different names/emails when you need two users (e.g. for the 403 test).
async function registerAndGetToken(name = 'Alice', email = 'alice@test.com') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'secret123' });
  return res.body.token;
}

// Helper: creates an item as the user owning `token` and returns it.
// Override any field: createItem(token, { title: 'Keys', status: 'found' })
async function createItem(token, body = {}) {
  const res = await request(app)
    .post('/api/items')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Black backpack', status: 'lost', category: 'accessories', location: 'Library', ...body });
  return res.body.item;
}

describe('/api/items', () => {
  // Worked example — read it, then write the two tests below in the same style.
  test('GET is public and returns an empty list when there are no items', async () => {
    const res = await request(app).get('/api/items');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1 — Reporting the SAME item twice must be rejected with HTTP 409.
  //
  // The rule: the Item model has a UNIQUE index on { title, location }
  // (see server/src/models/Item.js). So two items with the same title AND the
  // same location are not allowed. The controller turns MongoDB's duplicate-key
  // error (code 11000) into a 409 response (see itemController.js).
  //
  // `async` because every request below returns a Promise we `await`.
  // ──────────────────────────────────────────────────────────────────────────
  test('POST returns 409 when the same title is reported at the same location twice', async () => {
    // ── ARRANGE ──
    // Register a user and keep their JWT. POST /api/items is protected, so we
    // need a token to be allowed in at all.
    const token = await registerAndGetToken();

    // Create the FIRST item. We override title + location so WE control both
    // halves of the unique key. The database now holds "Blue umbrella @ Cafeteria".
    await createItem(token, { title: 'Blue umbrella', location: 'Cafeteria' });

    // ── ACT ──
    // Try to report a SECOND item with the exact same title AND location.
    const res = await request(app)
      .post('/api/items')                               // real HTTP POST into the Express app (no server/port)
      .set('Authorization', `Bearer ${token}`)          // attach the JWT so requireAuth lets us through
      .send({ title: 'Blue umbrella', status: 'lost', category: 'accessories', location: 'Cafeteria' });

    // ── ASSERT ──
    // Inserting the duplicate trips the unique index → 11000 → controller sends 409.
    // If the 409 handler were removed, this would be a 500 and the test would fail.
    expect(res.status).toBe(409);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2 — Only the person who REPORTED an item may edit it.
  //
  // The rule: updateItem loads the item and compares its `reportedBy` to the
  // logged-in user's id. If they differ it returns 403 BEFORE changing anything
  // (see itemController.js).
  //
  // The plan: make user A own an item, then have user B try to edit it.
  // ──────────────────────────────────────────────────────────────────────────
  test('PATCH returns 403 when someone who is not the reporter edits the item', async () => {
    // ── ARRANGE ──
    // Two DIFFERENT users. Different emails matter — registering the same email
    // twice would fail. Each call returns that user's own token.
    const ownerToken = await registerAndGetToken('Alice', 'alice@test.com');
    const otherToken = await registerAndGetToken('Bob', 'bob@test.com');

    // Alice creates an item (helper defaults: "Black backpack" @ "Library").
    // The server stamps reportedBy = Alice. We keep the created item's _id.
    const item = await createItem(ownerToken);

    // ── ACT ──
    // Bob (otherToken) tries to PATCH Alice's item. The body barely matters:
    // the request is rejected before any edit happens.
    const res = await request(app)
      .patch(`/api/items/${item._id}`)                  // target Alice's item by its id
      .set('Authorization', `Bearer ${otherToken}`)     // but authenticate as Bob
      .send({ title: 'Hijacked title' });

    // ── ASSERT ──
    // Bob is not the reporter, so the ownership check returns 403.
    // If that check were deleted, the edit would succeed (200) and this fails.
    expect(res.status).toBe(403);
  });
});
