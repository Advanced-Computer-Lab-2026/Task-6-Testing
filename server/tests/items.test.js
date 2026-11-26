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

  test('POST returns 409 when the same title is reported at the same location twice', async () => { // Checks that duplicate reports are rejected.
    const token = await registerAndGetToken(); // Creates the user who reports both items.
    const duplicate = { title: 'Blue umbrella', location: 'Student center' }; // Shares the unique fields with both reports.
    await createItem(token, duplicate); // Creates the first report so the second one is a duplicate.
    const res = await request(app).post('/api/items').set('Authorization', `Bearer ${token}`).send(duplicate); // Sends the matching report.
    expect(res.status).toBe(409); // Confirms the API returns its duplicate-conflict status.
  }); // Ends the duplicate-report test.

  test('PATCH returns 403 when someone who is not the reporter edits the item', async () => { // Checks that another user cannot edit a report.
    const reporterToken = await registerAndGetToken('Alice', 'alice-owner@test.com'); // Creates the user who owns the report.
    const otherToken = await registerAndGetToken('Bob', 'bob-editor@test.com'); // Creates a different user who will try to edit it.
    const item = await createItem(reporterToken); // Creates the item as its reporter.
    const res = await request(app).patch(`/api/items/${item._id}`).set('Authorization', `Bearer ${otherToken}`).send({ title: 'Changed title' }); // Attempts an edit as the other user.
    expect(res.status).toBe(403); // Confirms the API forbids edits by non-reporters.
  }); // Ends the ownership test.
});
