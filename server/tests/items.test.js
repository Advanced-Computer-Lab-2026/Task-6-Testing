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


  test('No Duplicate Title', async () => {
    //Creating a JWT token with a user that reported that item
    const token = await registerAndGetToken();
    await createItem(token, { title: 'Keys', location: 'Cafeteria' });

    //Reporting the same item twice again
    const res = await request(app) //request(app) is the Supertest - await waits for the return
    .post('/api/items')       //Creates the item
    .set('Authorization', `Bearer ${token}`)    //Identifies the user
    .send({ title: 'Keys', status: 'lost', category: 'accessories', location: 'Cafeteria' }); //Checks for the same item in the same location

    //The Assert part AKA waiting for the result
    expect(res.status).toBe(409);        // passes
  })


  test('Not the reporter edits an item', async () =>{
    //Creating JWT tokens for 2 users
    const token = await registerAndGetToken();  //Register a token for person 1
    const token2 = await registerAndGetToken('Amgad', 'amgad@student.guc.edu.eg'); //Register a token for person 2
    const item = await createItem(token);  //An item is reported, and kept

    //Amgad is trying to edit the item
    const res = await request(app)
    .patch(`/api/items/${item._id}`)              // PATCH edits the item 
    .set('Authorization', `Bearer ${token2}`)         // Amgad, not the reporter
    .send({ title: 'Blue backpack' });            // the attempted change

    //The Assert part AKA waiting for the result
    expect(res.status).toBe(403);        // passes
  })

  //test.todo('POST returns 409 when the same title is reported at the same location twice');
  //test.todo('PATCH returns 403 when someone who is not the reporter edits the item');
});
