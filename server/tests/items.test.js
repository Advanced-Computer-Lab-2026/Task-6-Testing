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

  test('POST returns 409 when the same title is reported at the same location twice', async () => {
    // Arrange(setting up what teh test needs in this case a registered user token and storing their jwt)
    const token = await registerAndGetToken();
    await createItem(token);

    // Act
    const res = await request(app) //sends request straight to the express app so we dont need a running server
      .post('/api/items') //endpoint for reporting an
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Black backpack', status: 'lost', category: 'accessories', location: 'Library' });

    // Assert
    expect(res.status).toBe(409);
  });

  test('PATCH returns 403 when a user different from the one that reported the item tries to edit it', async () => {
    // Arrange: two different users (different emails), and an item reported by ahmed
    const ahmedToken = await registerAndGetToken('ahmed', 'ahmed@test.com');
    const mohsenToken = await registerAndGetToken('mohsen', 'mohsen@test.com');
    const item = await createItem(ahmedToken); // keep it: we need item._id for the URL

    // Act: mohsen tries to edit ahmed's item
    const res = await request(app)
      .patch(`/api/items/${item._id}`)
      .set('Authorization', `Bearer ${mohsenToken}`)
      .send({ title: 'New title' });

    // Assert: mohsen is forbidden
    expect(res.status).toBe(403);
  });
});
