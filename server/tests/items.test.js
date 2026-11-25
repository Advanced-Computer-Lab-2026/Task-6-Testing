import request from 'supertest';
import app from '../src/app.js';

async function registerAndGetToken(name = 'Alice', email = 'alice@test.com') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'secret123' });
  return res.body.token;
}

async function createItem(token, body = {}) {
  const res = await request(app)
    .post('/api/items')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Black backpack', status: 'lost', category: 'accessories', location: 'Library', ...body });
  return res.body.item;
}

describe('/api/items', () => {
  test('GET is public and returns an empty list when there are no items', async () => {
    const res = await request(app).get('/api/items');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  test('POST returns 409 when the same title is reported at the same location twice', async () => {
    const token = await registerAndGetToken();
    await createItem(token, { title: 'Water bottle', location: 'Cafeteria' });

    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Water bottle', status: 'lost', category: 'other', location: 'Cafeteria' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Duplicate item at this location');
  });

  test('PATCH returns 403 when someone who is not the reporter edits the item', async () => {
    const ownerToken = await registerAndGetToken('Alice', 'alice@test.com');
    const otherToken = await registerAndGetToken('Bob', 'bob@test.com');
    const item = await createItem(ownerToken);

    const res = await request(app)
      .patch(`/api/items/${item._id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ status: 'claimed' });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('You can only edit items you reported');
  });
});
