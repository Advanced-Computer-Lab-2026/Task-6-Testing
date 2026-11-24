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

  // TEST 3 — Submitting the form
  // How it works:
  //   1. api.post.mockResolvedValue(...) makes the fake API "succeed" (no real server).
  //   2. renderAt('/items/new') shows the Report Item form.
  //   3. userEvent.type fills title, location, description (found by placeholder);
  //      userEvent.selectOptions picks a status and category in the two <select>s;
  //      userEvent.click presses Save. Each is awaited because userEvent is async.
  //   4. We assert api.post was called once, with '/items' and EXACTLY the five
  //      fields — toHaveBeenCalledWith compares the whole object, so any extra
  //      field fails it. We also check explicitly there is no reportedBy
  //      (the server sets the reporter from the token, the client must not send it).
  //   5. findByText('Items page') WAITS for the redirect, proving nav('/items') ran.
  // Why it would fail if broken: wrong/missing/extra fields, or no navigation.
  test('submitting POSTs { title, status, category, location, description } (no reportedBy) and navigates to /items', async () => {
    // Arrange: the fake API succeeds
    api.post.mockResolvedValue({ data: { item: {} } })
    renderAt('/items/new')

    // Act: fill in every field and click Save
    await userEvent.type(screen.getByPlaceholderText(/title/i), 'Black backpack')
    const [status, category] = screen.getAllByRole('combobox')
    await userEvent.selectOptions(status, 'found')
    await userEvent.selectOptions(category, 'accessories')
    await userEvent.type(screen.getByPlaceholderText(/location/i), 'Library')
    await userEvent.type(screen.getByPlaceholderText(/description/i), 'Has a red keychain')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    // Assert: exactly these five fields were sent (toHaveBeenCalledWith + toEqual-style
    // matching fails if an extra key like reportedBy is present), then we navigated
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledWith('/items', {
      title: 'Black backpack',
      status: 'found',
      category: 'accessories',
      location: 'Library',
      description: 'Has a red keychain'
    })
    expect(api.post.mock.calls[0][1]).not.toHaveProperty('reportedBy')
    expect(await screen.findByText('Items page')).toBeInTheDocument()
  })

  // TEST 4 — Showing the server's error
  // How it works:
  //   1. api.post.mockRejectedValue(...) makes the fake API fail the same way the
  //      real server does on a 409: err.response.data.message = 'Duplicate item...'.
  //   2. We render the form, fill title + location, and click Save.
  //   3. onSubmit's catch block calls setError(err.response.data.message),
  //      and the form renders that error text.
  //   4. findByText WAITS for the message to appear (it shows up after an async step).
  //   5. queryByText('Items page') returns null → we did NOT navigate away
  //      (queryBy is used because getBy would throw when the element is missing).
  //      The "Report Item" heading is still there → still on the form.
  // Why it would fail if broken: if setError(...) in the catch is removed,
  // the message never appears and findByText times out.
  test('shows the server\'s message when the request fails (e.g. 409) and stays on the page', async () => {
    // Arrange: the fake API rejects like the server does for a duplicate
    api.post.mockRejectedValue({ response: { data: { message: 'Duplicate item at this location' } } })
    renderAt('/items/new')

    // Act: fill in the title and submit
    await userEvent.type(screen.getByPlaceholderText(/title/i), 'Black backpack')
    await userEvent.type(screen.getByPlaceholderText(/location/i), 'Library')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    // Assert: the server's message is shown and we are still on the form
    expect(await screen.findByText('Duplicate item at this location')).toBeInTheDocument()
    expect(screen.queryByText('Items page')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /report item/i })).toBeInTheDocument()
  })
})
