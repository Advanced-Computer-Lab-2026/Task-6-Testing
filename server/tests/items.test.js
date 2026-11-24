// Backend tests for /api/items — THIS is the only backend file you edit.
// Run with:  npm test --workspace server
//
// tests/setup.js already starts an in-memory MongoDB and empties it after
// every test, so each test starts from a clean database.
//
// TYPE OF TEST: integration test. A real HTTP request goes through
// Express -> routes -> auth middleware -> controller -> MongoDB, and we check the response.

// supertest: sends HTTP requests straight to the Express app, no need to start a server (no app.listen)
import request from 'supertest';
// the Express app itself (routes + middleware), exported without listening on a port
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

// describe = groups related tests under one name
describe('/api/items', () => {
  // Worked example — read it, then write the two tests below in the same style.
  test('GET is public and returns an empty list when there are no items', async () => {
    const res = await request(app).get('/api/items');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  // ===================================================================
  // MY TEST 1: duplicate report -> 409 Conflict
  // WHAT IT CHECKS: you can't report the same title at the same location twice.
  // WHY IT WORKS: the Item model has a UNIQUE index on { title, location }
  //   (server/src/models/Item.js). setup.js builds it with Item.syncIndexes().
  //   The second insert makes MongoDB throw error code 11000 (duplicate key), and
  //   createItem in itemController.js catches it: if (err.code === 11000) -> 409.
  // WHAT IF THE FEATURE BREAKS: delete the 11000 line -> the server returns 500,
  //   so expect(409) fails. Delete the unique index -> 201, so the test fails too.
  // ===================================================================
  // async because we need await (HTTP requests take time)
  test('POST returns 409 when the same title is reported at the same location twice', async () => {
    // ---- ARRANGE: set up what we need ----
    // register a user (default Alice) and get her JWT; POST /api/items needs login
    const token = await registerAndGetToken();
    // report the item the FIRST time (default: "Black backpack" at "Library") -> this one succeeds (201)
    await createItem(token);

    // ---- ACT: do the thing we're testing ----
    // send the SAME title + location again
    const res = await request(app)
      .post('/api/items')                          // the endpoint for reporting an item
      .set('Authorization', `Bearer ${token}`)     // send the JWT in the header so we are logged in (otherwise 401)
      .send({ title: 'Black backpack', status: 'lost', category: 'accessories', location: 'Library' }); // same title + location = duplicate

    // ---- ASSERT: check the result ----
    // 409 = Conflict: the request clashes with something that already exists
    expect(res.status).toBe(409);
    // check it's the duplicate error specifically (the message from the controller), not some other 409
    expect(res.body.message).toBe('Duplicate item at this location');
  });

  // ===================================================================
  // MY TEST 2: not the reporter -> 403 Forbidden
  // WHAT IT CHECKS: only the person who reported an item can edit it.
  // WHY IT WORKS: updateItem in itemController.js does
  //   if (existing.reportedBy?.toString() !== req.user.id) return res.status(403)
  //   i.e. it compares the item's owner with the logged-in user from the JWT.
  // WHY 403 AND NOT 401: 401 = not logged in. Bob IS logged in (valid token),
  //   he just isn't ALLOWED to edit this item, so it's 403.
  // WHAT IF THE FEATURE BREAKS: delete the ownership check -> Bob's PATCH works
  //   (200) and the title changes, so both asserts fail.
  // ===================================================================
  test('PATCH returns 403 when someone who is not the reporter edits the item', async () => {
    // ---- ARRANGE ----
    // user 1 (owner). DIFFERENT emails are required because email is unique
    const ownerToken = await registerAndGetToken('Alice', 'alice@test.com');
    // user 2 (the one who is not allowed)
    const otherToken = await registerAndGetToken('Bob', 'bob@test.com');
    // Alice creates the item, so reportedBy = Alice. We keep the item for its _id
    const item = await createItem(ownerToken);

    // ---- ACT ----
    // Bob tries to edit Alice's item
    const res = await request(app)
      .patch(`/api/items/${item._id}`)              // PATCH = partial update; the item's id goes in the URL
      .set('Authorization', `Bearer ${otherToken}`) // logged in as BOB, not Alice
      .send({ title: 'Stolen title' });             // the change Bob tries to make

    // ---- ASSERT ----
    // 403 = Forbidden: logged in, but not allowed
    expect(res.status).toBe(403);
    // extra check: fetch the item again (GET is public, no token needed)...
    const check = await request(app).get(`/api/items/${item._id}`);
    // ...and make sure the title did NOT change, so the edit really was blocked
    expect(check.body.item.title).toBe('Black backpack');
  });
});
