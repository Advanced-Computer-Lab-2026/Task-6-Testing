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

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1 — The happy path: filling the form and clicking Save should send the
  // right data to the server and then move the user to the items list.
  //
  // Remember: `api` is MOCKED (top of file), so api.post is a fake function. It
  // doesn't really call a server — it just records how it was called and returns
  // whatever we told it to. That lets us test the COMPONENT'S behavior alone.
  // ──────────────────────────────────────────────────────────────────────────
  test('submitting POSTs { title, status, category, location, description } (no reportedBy) and navigates to /items', async () => {
    // ── ARRANGE ──
    // Tell the fake api.post to "succeed": return a resolved promise. The exact
    // returned shape doesn't matter to the component here, so {} item is fine.
    api.post.mockResolvedValue({ data: { item: {} } })
    renderAt('/items/new')   // render the form in "report" mode

    // ── ACT ── (drive the UI exactly like a real user)
    // Find the Title box by its placeholder text and type into it.
    await userEvent.type(screen.getByPlaceholderText(/title/i), 'Black backpack')
    // There are two <select> dropdowns; getAllByRole returns them in order.
    const [status, category] = screen.getAllByRole('combobox')
    // Pick NON-default values on purpose — this proves the form really reads the
    // selects, instead of the test passing just because they match the defaults.
    await userEvent.selectOptions(status, 'found')
    await userEvent.selectOptions(category, 'accessories')
    await userEvent.type(screen.getByPlaceholderText(/location/i), 'Library')
    await userEvent.type(screen.getByPlaceholderText(/description/i), 'Has a laptop inside')
    // Submit the form.
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    // ── ASSERT ──
    // 1) The fake recorded its call: check the URL and the EXACT payload.
    //    toHaveBeenCalledWith fails if a key is missing, extra, or different —
    //    so this also proves `reportedBy` is NOT sent (the server adds that).
    expect(api.post).toHaveBeenCalledWith('/items', {
      title: 'Black backpack',
      status: 'found',
      category: 'accessories',
      location: 'Library',
      description: 'Has a laptop inside'
    })
    // 2) After a successful save the component calls nav('/items'), which renders
    //    the text "Items page". findBy* WAITS for that async re-render (getBy*
    //    would not wait and could fail too early). Its presence proves we navigated.
    expect(await screen.findByText('Items page')).toBeInTheDocument()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2 — The error path: when the server rejects the save (e.g. a duplicate,
  // 409), the component should show the server's message AND keep the user on the
  // form (NOT navigate away).
  // ──────────────────────────────────────────────────────────────────────────
  test('shows the server\'s message when the request fails (e.g. 409) and stays on the page', async () => {
    // ── ARRANGE ──
    // Make the fake api.post REJECT (fail). The object is shaped like a real axios
    // error so the component can read err.response.data.message out of it.
    api.post.mockRejectedValue({ response: { data: { message: 'Duplicate item at this location' } } })
    renderAt('/items/new')

    // ── ACT ──
    // A title is enough to submit; then click Save to trigger the failing request.
    await userEvent.type(screen.getByPlaceholderText(/title/i), 'Black backpack')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    // ── ASSERT ──
    // 1) The catch block calls setError(message), so the text appears on screen.
    //    (If setError were removed, this findBy* would time out → test fails.)
    expect(await screen.findByText('Duplicate item at this location')).toBeInTheDocument()
    // 2) On failure the component must NOT navigate. queryBy* returns null (instead
    //    of throwing) when absent, which is the correct way to assert "not there".
    expect(screen.queryByText('Items page')).not.toBeInTheDocument()
  })
})
