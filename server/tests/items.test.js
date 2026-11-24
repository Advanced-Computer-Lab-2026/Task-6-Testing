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

  // TEST 1 — Duplicate report → 409
  // How it works:
  //   1. registerAndGetToken() creates a user and gives us their JWT.
  //   2. createItem(token) reports "Black backpack" at "Library" (first time → 201).
  //   3. We POST the exact same title + location again with the same token.
  //   4. The Item model has a unique index on { title, location } (models/Item.js),
  //      so MongoDB rejects the second insert with error code 11000, and
  //      createItem in itemController.js turns that into a 409.
  //   5. We assert status 409 and the "Duplicate item at this location" message.
  // Why it would fail if broken: without the unique index the second POST
  // would succeed with 201 instead of 409.
  test('POST returns 409 when the same title is reported at the same location twice', async () => {
    // Arrange: a logged-in user who has already reported "Black backpack" at "Library"
    const token = await registerAndGetToken();
    await createItem(token);

    // Act: report the exact same title + location again
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Black backpack', status: 'lost', category: 'accessories', location: 'Library' });

    // Assert: rejected as a duplicate
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Duplicate item at this location');
  });

  // TEST 2 — Not the reporter → 403
  // How it works:
  //   1. We register two different users (different emails): Alice and Bob.
  //   2. Alice creates an item, so the item's reportedBy = Alice's id.
  //   3. Bob sends PATCH /api/items/:id with HIS token, trying to change the title.
  //   4. updateItem in itemController.js compares item.reportedBy with
  //      req.user.id (taken from the token). They don't match → 403.
  //   5. We assert status 403, then GET the item to prove the title was
  //      NOT changed (the edit was really blocked, not just reported as blocked).
  // Why it would fail if broken: without the ownership check Bob's PATCH
  // returns 200 and the title becomes "Hacked title".
  test('PATCH returns 403 when someone who is not the reporter edits the item', async () => {
    // Arrange: Alice reports an item, Bob is a different logged-in user
    const aliceToken = await registerAndGetToken('Alice', 'alice@test.com');
    const bobToken = await registerAndGetToken('Bob', 'bob@test.com');
    const item = await createItem(aliceToken);

    // Act: Bob tries to edit Alice's item
    const res = await request(app)
      .patch(`/api/items/${item._id}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ title: 'Hacked title' });

    // Assert: forbidden, and the item is unchanged
    expect(res.status).toBe(403);
    const after = await request(app).get(`/api/items/${item._id}`);
    expect(after.body.item.title).toBe('Black backpack');
  });
});
