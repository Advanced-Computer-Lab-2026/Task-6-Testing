# Prompt: implement the Task 6 Jest testing suite

Copy everything below the line into your AI coding assistant, run from the
repository root.

---

You are working in the "Campus Lost & Found" repo (Express + MongoDB API with
JWT auth in `server/`, React + Vite client in `client/`, npm workspaces). The
app is finished and correct. Your job is to write automated Jest tests that
prove it works. Read `README.md` first; it is the spec.

## Hard rules

- Edit **only** these two files:
  - `server/tests/items.test.js`
  - `client/src/pages/ItemForm.test.jsx`
- Do **not** change app code, Jest config, `server/tests/setup.js`,
  `client/jest.setup.js`, the provided helpers, the `jest.mock('../api', …)`
  block, or the existing worked-example tests. Do not add dependencies.
- Turn each of the 4 `test.todo(...)` lines into a real `test(...)` that keeps
  the **same test name**. Follow the style of the worked example in each file
  (Arrange / Act / Assert, `async`/`await`).
- Use only what is already imported in each file (`request`, `app`,
  `registerAndGetToken`, `createItem` on the backend; `render`, `screen`,
  `userEvent`, `renderAt`, the mocked `api` on the frontend).
- No `.only`, `.skip`, `console.log`, or leftover `test.todo`.

## Read before writing

- `server/src/controllers/itemController.js` — `createItem` returns `409`
  when Mongo throws duplicate-key error `11000`; `updateItem` returns `403`
  when `existing.reportedBy` is not `req.user.id`.
- `server/src/models/Item.js` — the unique index on `title` + `location`
  that causes the duplicate error.
- `server/tests/setup.js` — in-memory MongoDB, indexes synced in `beforeAll`,
  database emptied after every test.
- `client/src/pages/ItemForm.jsx` — the form fields, the `onSubmit` body
  `{ title, status, category, location, description }`, `nav('/items')` on
  success, `setError(err?.response?.data?.message || 'Save failed')` on failure.

## Test 1 (backend): `POST returns 409 when the same title is reported at the same location twice`

1. Arrange: get a token with `registerAndGetToken()`; create an item with
   `createItem(token)` (default `Black backpack` at `Library`).
2. Act: `POST /api/items` again with `request(app)`, the same
   `Authorization: Bearer <token>` header, and the same `title` and
   `location` (plus valid `status`/`category`).
3. Assert: `res.status` is `409`. Also assert
   `res.body.message` is `'Duplicate item at this location'`.

## Test 2 (backend): `PATCH returns 403 when someone who is not the reporter edits the item`

1. Arrange: two users with **different emails**, e.g.
   `registerAndGetToken('Alice', 'alice@test.com')` and
   `registerAndGetToken('Bob', 'bob@test.com')`. Create an item as Alice.
2. Act: `PATCH /api/items/${item._id}` with **Bob's** token and a valid
   change, e.g. `{ title: 'Stolen title' }`.
3. Assert: `res.status` is `403`. Then `GET /api/items/${item._id}` and assert
   the title is still `'Black backpack'` (the edit did not happen).

## Test 3 (frontend): `submitting POSTs { title, status, category, location, description } (no reportedBy) and navigates to /items`

1. Arrange: `api.post.mockResolvedValue({ data: { item: {} } })`;
   `renderAt('/items/new')`.
2. Act, like a user would, with `await userEvent...`:
   - type a title into `screen.getByPlaceholderText(/title/i)`
   - pick a status and category with `userEvent.selectOptions` on the two
     comboboxes from `screen.getAllByRole('combobox')` (choose non-default
     values, e.g. `found` and `electronics`, so the test proves the selects
     are wired up)
   - type into `getByPlaceholderText(/location/i)` and
     `getByPlaceholderText(/description/i)`
   - click `screen.getByRole('button', { name: /save/i })`
3. Assert:
   - `await screen.findByText('Items page')` (navigation happened; use
     `findBy` because the submit is async)
   - `expect(api.post).toHaveBeenCalledTimes(1)`
   - `expect(api.post).toHaveBeenCalledWith('/items', { title, status, category, location, description })`
     with the exact values typed. `toHaveBeenCalledWith` compares with
     recursive equality, so an extra `reportedBy` key would fail it. Also
     assert `expect(api.post.mock.calls[0][1]).not.toHaveProperty('reportedBy')`
     to make that check explicit.

## Test 4 (frontend): `shows the server's message when the request fails (e.g. 409) and stays on the page`

1. Arrange: `api.post.mockRejectedValue({ response: { status: 409, data: { message: 'Duplicate item at this location' } } })`;
   `renderAt('/items/new')`.
2. Act: type a title (and location), click Save.
3. Assert:
   - `expect(await screen.findByText('Duplicate item at this location')).toBeInTheDocument()`
   - `expect(screen.queryByText('Items page')).not.toBeInTheDocument()` (use
     `queryBy` to assert something is absent)
   - the Report Item heading is still shown.

## Verify (required, do not skip)

1. Run `npm test` from the repo root (first run downloads MongoDB, which can
   take a minute). It must report **0 failed** and **0 todo** across both
   workspaces: 3 passing backend tests, 3 passing frontend tests.
2. Show that each test can fail. Make each change below **temporarily**, run
   that workspace's tests, confirm the named test fails, then revert with
   `git checkout -- <file>`:
   - Delete the `if (err.code === 11000) …` line in `createItem` in
     `server/src/controllers/itemController.js` → Test 1 fails.
   - Delete the ownership `if (existing.reportedBy?.toString() !== req.user.id) {…}`
     block in `updateItem` → Test 2 fails.
   - In `ItemForm.jsx` `onSubmit`, change the body to
     `{ ...form, reportedBy: 'x' }` → Test 3 fails.
   - Comment out the `setError(...)` in the `catch` of `onSubmit` → Test 4
     fails.
3. Run `git status` at the end: only the two test files may be modified.

## Report back

For each of the 4 tests, give:

- what it checks, in one sentence;
- which app line makes it pass, and which sabotage made it fail (with the
  failing output you saw);
- a line-by-line explanation of the test, simple enough for me to explain it
  out loud to an instructor.

Then paste the final `npm test` summary.
