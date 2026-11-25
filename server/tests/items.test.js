npm run test// Backend tests for /api/items — THIS is the only backend file you edit.
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

  // ---------------------------------------------------------------------------
  // TEST 1 — Duplicate report -> 409 Conflict
  //
  // WHAT it checks: the same title at the same location cannot be reported twice.
  // HOW the app does it: src/models/Item.js has a UNIQUE index on
  //   { title: 1, location: 1 }. When the 2nd insert breaks that index, MongoDB
  //   throws an error with code 11000, and createItem() in itemController.js
  //   catches it and answers 409 'Duplicate item at this location'.
  // WHY it would fail if the feature broke: if the unique index were removed,
  //   or the `err.code === 11000` branch deleted, the 2nd POST would get 201
  //   (or 500) instead of 409, and expect(res.status).toBe(409) would fail.
  // ---------------------------------------------------------------------------
  test('POST returns 409 when the same title is reported at the same location twice', async () => {
    // ---- Arrange ----
    // Register a user and get their JWT (needed because POST requires login).
    const token = await registerAndGetToken();
    // First report: helper creates "Black backpack" at "Library" as this user.
    const first = await createItem(token);
    // Sanity check: the first report really was saved (it got a MongoDB _id).
    // Without this, a broken setup could make the test pass for the wrong reason.
    expect(first).toHaveProperty('_id');

    // ---- Act ----
    // Send the SAME title + SAME location again, as a real HTTP request.
    const res = await request(app)                    // Supertest talks to the Express app directly
      .post('/api/items')                             // the "report an item" endpoint
      .set('Authorization', `Bearer ${token}`)        // logged in as the same user
      .send({ title: 'Black backpack', status: 'lost', category: 'accessories', location: 'Library' }); // JSON body

    // ---- Assert ----
    // 409 = Conflict: the request clashes with data that already exists.
    expect(res.status).toBe(409);
    // The controller's error message reaches the client.
    expect(res.body.message).toBe('Duplicate item at this location');
    // The duplicate was NOT saved: the public list still has exactly one item.
    const list = await request(app).get('/api/items');
    expect(list.body.items).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // TEST 2 — Not the reporter -> 403 Forbidden
  //
  // WHAT it checks: only the user who reported an item may edit it.
  // HOW the app does it: updateItem() in itemController.js compares
  //   existing.reportedBy (the owner's id) with req.user.id (taken from the JWT
  //   by the auth middleware). If they differ it answers 403.
  // WHY it would fail if the feature broke: delete that ownership check and
  //   Bob's PATCH succeeds with 200 -> expect(...).toBe(403) fails, and the
  //   title would also have changed -> the last expect fails too.
  // Note: 403 (logged in but not allowed) is different from 401 (not logged in).
  //   Bob IS logged in, so this proves the ownership check, not the login check.
  // ---------------------------------------------------------------------------
  test('PATCH returns 403 when someone who is not the reporter edits the item', async () => {
    // ---- Arrange ----
    // Two DIFFERENT users (different emails, because email must be unique).
    const aliceToken = await registerAndGetToken('Alice', 'alice@test.com');
    const bobToken = await registerAndGetToken('Bob', 'bob@test.com');
    // Alice reports the item, so Alice is its owner (reportedBy = Alice's id).
    const item = await createItem(aliceToken);

    // ---- Act ----
    // Bob tries to change the title of Alice's item.
    const res = await request(app)
      .patch(`/api/items/${item._id}`)                // edit endpoint for THIS item's id
      .set('Authorization', `Bearer ${bobToken}`)     // ...but authenticated as Bob
      .send({ title: 'Stolen by Bob' });              // the change he attempts

    // ---- Assert ----
    // 403 = Forbidden: Bob is logged in but not allowed to edit this item.
    expect(res.status).toBe(403);
    // The exact message from the ownership check in updateItem().
    expect(res.body.message).toBe('You can only edit items you reported');
    // Re-read the item from the API: the title must be unchanged,
    // proving the rejected request did not modify the database.
    const after = await request(app).get(`/api/items/${item._id}`);
    expect(after.body.item.title).toBe('Black backpack');
  });
});
