// Backend tests for /api/items
// Run with: npm test --workspace server

import request from 'supertest';
import app from '../src/app.js';

// Helper: registers a user and returns their JWT.
async function registerAndGetToken(name = 'Alice', email = 'alice@test.com') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'secret123' });
  return res.body.token;
}

// Helper: creates an item as the user owning token.
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

  // Original example test
  test('GET is public and returns an empty list when there are no items', async () => {
    const res = await request(app).get('/api/items');

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  // Test 1: Duplicate report
  test('POST returns 409 when the same title is reported at the same location twice', async () => {

    // Arrange
    const token = await registerAndGetToken();
    const item = await createItem(token);
    expect(item).toHaveProperty('_id');

    // Act
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Black backpack',
        status: 'lost',
        category: 'accessories',
        location: 'Library'
      });

    // Assert
    expect(res.status).toBe(409);
  });

  // Test 2: Ownership check
  test('PATCH returns 403 when someone who is not the reporter edits the item', async () => {

    // Arrange
    const aliceToken = await registerAndGetToken('Alice', 'alice@test.com');
    const bobToken = await registerAndGetToken('Bob', 'bob@test.com');

    const item = await createItem(aliceToken);
    expect(item).toHaveProperty('_id');

    // Act
    const res = await request(app)
      .patch(`/api/items/${item._id}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ title: 'Blue backpack' });

    // Assert
    expect(res.status).toBe(403);
  });

});