import request from 'supertest';
import app from '../src/app.js';

// Helper: registers a user and returns their JWT.
async function registerAndGetToken(
  name = 'Alice',
  email = 'alice@test.com'
) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'secret123' });

  return res.body.token;
}

// Helper: creates an item and returns it.
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

  // Test 1: Get empty items list.
  test('GET is public and returns an empty list when there are no items', async () => {
    const res = await request(app).get('/api/items');

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  // Test 2: Reject duplicate reports.
  test('POST returns 409 when reporting the same title at the same location twice', async () => {
    const token = await registerAndGetToken();

    const item = await createItem(token);
    expect(item).toBeDefined();

    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Black backpack',
        status: 'lost',
        category: 'accessories',
        location: 'Library'
      });

    expect(res.status).toBe(409);
  });

  // Test 3: Prevent unauthorized editing.
  test('PATCH returns 403 when the user is not the reporter', async () => {
    const ownerToken = await registerAndGetToken(
      'Alice',
      'alice@test.com'
    );

    const otherToken = await registerAndGetToken(
      'Bob',
      'bob@test.com'
    );

    const item = await createItem(ownerToken);

    const res = await request(app)
      .patch(`/api/items/${item._id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        title: 'Updated backpack'
      });

    expect(res.status).toBe(403);
  });

});