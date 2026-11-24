
// Backend tests for /api/items — THIS is the only backend file you edit.
import request from 'supertest';
import app from '../src/app.js';

// Helper: registers a user and returns their JWT.
async function registerAndGetToken(name = 'Alice', email = 'alice@test.com') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'secret123' });
  return res.body.token;
}

// Helper: creates an item as the user owning `token` and returns it.
async function createItem(token, body = {}) {
  const res = await request(app)
    .post('/api/items')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: 'Black backpack',
      status: 'lost',
      category: 'accessories',
      location: 'Library',
      ...body
    });
  return res.body.item;
}

describe('/api/items', () => {

  // Example test
  test('GET is public and returns an empty list when there are no items', async () => {
    const res = await request(app).get('/api/items');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  // Test 1: Duplicate report should return 409
  test('POST returns 409 when the same title is reported at the same location twice', async () => {
    const token = await registerAndGetToken();

    // First report: should be created successfully.
    await createItem(token, {
      title: 'Lost phone',
      location: 'Main Library'
    });

    // Second report: same title and location.
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Lost phone',
        status: 'lost',
        category: 'electronics',
        location: 'Main Library'
      });

    expect(res.status).toBe(409);
  });

  // Test 2: Another user should not be allowed to edit the item.
  test('PATCH returns 403 when someone who is not the reporter edits the item', async () => {
    // Register two different users.
    const firstToken = await registerAndGetToken(
      'Alice',
      'alice-owner@test.com'
    );

    const secondToken = await registerAndGetToken(
      'Bob',
      'bob-other@test.com'
    );

    // Alice creates the item.
    const item = await createItem(firstToken);

    // Bob tries to edit Alice's item.
    const res = await request(app)
      .patch(`/api/items/${item._id}`)
      .set('Authorization', `Bearer ${secondToken}`)
      .send({ title: 'Updated backpack' });

    expect(res.status).toBe(403);
  });

});
