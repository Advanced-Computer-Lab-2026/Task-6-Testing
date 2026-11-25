// Frontend tests for the ItemForm page — THIS is the only frontend file you edit.
// Run with:  npm test --workspace client
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ItemForm from './ItemForm.jsx'
import { api } from '../api'

// Replace the real axios instance with fake (mock) functions — no server needed.
// In a test you decide what each one returns, e.g.
//   api.post.mockResolvedValue({ data: { item: {} } })                                  // success
//   api.post.mockRejectedValue({ response: { status: 409, data: { message: '...' } } }) // failure
// and afterwards check how it was called:
//   expect(api.post).toHaveBeenCalledWith('/items', { ... })
jest.mock('../api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() }
}))

// Helper: renders ItemForm at `path`. "/items/new" = report mode, "/items/<id>" = edit mode.
// After a successful save the page navigates to /items, which renders the text "Items page".
function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/items/new" element={<ItemForm />} />
        <Route path="/items/:id" element={<ItemForm />} />
        <Route path="/items" element={<div>Items page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

// Reset every mock's calls and return values before each test.
beforeEach(() => jest.clearAllMocks())

describe('ItemForm — report mode (/items/new)', () => {
  // Worked example — read it, then write the two tests below in the same style.
  test('renders all fields with their default values', () => {
    renderAt('/items/new')
    expect(screen.getByRole('heading', { name: /report item/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/title/i)).toHaveValue('')
    const [status, category] = screen.getAllByRole('combobox') // the two <select>s
    expect(status).toHaveValue('lost')
    expect(category).toHaveValue('other')
  })

  // ---------------------------------------------------------------------------
  // TEST 1 — Submitting the form
  //
  // WHAT it checks: when the user fills the form and clicks Save, ItemForm
  //   (1) calls api.post('/items', body) with EXACTLY the five editable fields
  //       { title, status, category, location, description } — no reportedBy,
  //       because the server sets the owner from the JWT and rejects reportedBy;
  //   (2) navigates to /items after the request succeeds.
  // WHY it would fail if the feature broke: if onSubmit sent different/extra
  //   fields, toHaveBeenCalledWith would not match; if nav('/items') were
  //   removed, "Items page" would never appear and findByText would time out.
  // ---------------------------------------------------------------------------
  test('submitting POSTs { title, status, category, location, description } (no reportedBy) and navigates to /items', async () => {
    // ---- Arrange ----
    // Make the fake api.post return a resolved Promise, i.e. "the server said OK".
    api.post.mockResolvedValue({ data: { item: { _id: '1' } } })
    // Render the page in report mode (no :id in the URL -> POST, not PATCH).
    renderAt('/items/new')

    // ---- Act ----
    // The form has two <select>s (role "combobox"): first status, then category.
    const [status, category] = screen.getAllByRole('combobox')
    // Type into the inputs, found by their placeholder text — like a real user.
    await userEvent.type(screen.getByPlaceholderText(/title/i), 'Black backpack')
    // Pick non-default options so we prove the chosen values are sent
    // (defaults are 'lost' / 'other').
    await userEvent.selectOptions(status, 'found')
    await userEvent.selectOptions(category, 'accessories')
    await userEvent.type(screen.getByPlaceholderText(/location/i), 'Library')
    await userEvent.type(screen.getByPlaceholderText(/description/i), 'Has a red keychain')
    // Click the Save button -> submits the form -> runs onSubmit().
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    // ---- Assert ----
    // findBy* WAITS (async) until the text appears. "Items page" is only
    // rendered by the /items route, so seeing it proves nav('/items') happened.
    expect(await screen.findByText('Items page')).toBeInTheDocument()
    // The form was submitted exactly once (no double submit).
    expect(api.post).toHaveBeenCalledTimes(1)
    // Called with the right URL and exactly these fields. toHaveBeenCalledWith
    // compares objects by deep equality, so an extra key would make it fail.
    expect(api.post).toHaveBeenCalledWith('/items', {
      title: 'Black backpack',
      status: 'found',
      category: 'accessories',
      location: 'Library',
      description: 'Has a red keychain'
    })
    // Extra explicit check: mock.calls[0] is the 1st call's arguments,
    // [1] is the 2nd argument (the body). It must not contain reportedBy.
    expect(api.post.mock.calls[0][1]).not.toHaveProperty('reportedBy')
  })

  // ---------------------------------------------------------------------------
  // TEST 2 — Showing the server's error
  //
  // WHAT it checks: when the request fails, the catch block in onSubmit shows
  //   err.response.data.message on the page, and the user stays on the form.
  // WHY it would fail if the feature broke: comment out setError(...) in the
  //   catch and the message never appears -> findByText times out and fails.
  //   If the code navigated even on failure, "Items page" would be found and
  //   the queryByText(...).not.toBeInTheDocument() check would fail.
  // ---------------------------------------------------------------------------
  test('shows the server\'s message when the request fails (e.g. 409) and stays on the page', async () => {
    // ---- Arrange ----
    // Make the fake api.post return a REJECTED Promise shaped like an axios
    // error from the server (this is what the backend sends for a 409).
    api.post.mockRejectedValue({ response: { data: { message: 'Duplicate item at this location' } } })
    renderAt('/items/new')

    // ---- Act ----
    // Fill in the title and location, then submit.
    await userEvent.type(screen.getByPlaceholderText(/title/i), 'Black backpack')
    await userEvent.type(screen.getByPlaceholderText(/location/i), 'Library')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    // ---- Assert ----
    // Wait for the server's message to be rendered in the error <div>.
    expect(await screen.findByText('Duplicate item at this location')).toBeInTheDocument()
    // queryBy* returns null instead of throwing, so it is the right tool to
    // check something is NOT there: we did not navigate to /items.
    expect(screen.queryByText('Items page')).not.toBeInTheDocument()
    // And the form is still on screen (we are still on the Report Item page).
    expect(screen.getByRole('heading', { name: /report item/i })).toBeInTheDocument()
    // The request really was attempted once (so the error came from it).
    expect(api.post).toHaveBeenCalledTimes(1)
  })
})
