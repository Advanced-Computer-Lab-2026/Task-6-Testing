// Backend tests for /api/items — THIS is the only backend file you edit.
// Run with:  npm test --workspace server
//
// tests/setup.js already starts an in-memory MongoDB and empties it after
// every test, so each test starts from a clean database.
import request from 'supertest';
import app from '../src/app.js';

// --- Windows workaround, keep it -------------------------------------------
// tests/setup.js starts an in-memory MongoDB with default options, so its data
// directory (`mongod --dbpath`) is created inside os.tmpdir(). On this machine
// os.tmpdir() is C:\, which has almost no free space, and MongoDB refuses to
// build the unique index the 409 test needs when the data drive has less than
// ~500 MB free:
//   "available disk space of 306528256 bytes is less than required minimum of 524288000"
//
// Setting process.env.TMP/TEMP does not help: Jest gives every test file its
// own copy of process.env, so Node's real process.env (which os.tmpdir() reads)
// is left unchanged. Redirect os.tmpdir() itself instead, to a folder on the
// same drive as this project, which has plenty of space.
import os from 'os';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mongoTempDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'node_modules', '.cache', 'mongodb-memory-server-dbpath');
mkdirSync(mongoTempDir, { recursive: true });
os.tmpdir = () => mongoTempDir;
// ---------------------------------------------------------------------------

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

  test('POST returns 409 when the same title is reported at the same location twice', async () => {
    // ARRANGE: one logged-in user who has already reported "Black backpack" at "Library".
    const token = await registerAndGetToken();
    const first = await createItem(token);
    expect(first).toBeDefined(); // the first report must have been saved, otherwise this test proves nothing

    // ACT: report the exact same title at the exact same location a second time.
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Black backpack', status: 'lost', category: 'accessories', location: 'Library' });

    // ASSERT: the duplicate is rejected with 409 and the server's explanatory message...
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Duplicate item at this location');

    // ...and it was NOT stored: the list still contains only the original item.
    const list = await request(app).get('/api/items');
    expect(list.body.items).toHaveLength(1);
  });

  test('PATCH returns 403 when someone who is not the reporter edits the item', async () => {
    // ARRANGE: two different users. Alice reports an item; Bob did not.
    const aliceToken = await registerAndGetToken('Alice', 'alice@test.com');
    const bobToken = await registerAndGetToken('Bob', 'bob@test.com');
    const item = await createItem(aliceToken);

    // ACT: Bob (valid token, but not the reporter) tries to edit Alice's item.
    const res = await request(app)
      .patch(`/api/items/${item._id}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ title: 'Stolen by Bob' });

    // ASSERT: forbidden, with the server's message...
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('You can only edit items you reported');

    // ...and the item in the database was NOT changed.
    const check = await request(app).get(`/api/items/${item._id}`);
    expect(check.body.item.title).toBe('Black backpack');
  });
});