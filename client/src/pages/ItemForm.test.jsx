// Frontend tests for the ItemForm page — THIS is the only frontend file you edit.
// Run with:  npm test --workspace client
//
// TYPE OF TEST: unit/component test. We render ONLY the ItemForm component in a fake
// browser (jsdom), and the API is faked (mocked), so no real server is called.

// render: draws the component into the fake page. screen: lets us search the page
import { render, screen } from '@testing-library/react'
// userEvent: acts like a real user (typing, clicking, choosing from a select)
import userEvent from '@testing-library/user-event'
// MemoryRouter: a router that lives in memory (no real browser URL), so we can test navigation
import { MemoryRouter, Routes, Route } from 'react-router-dom'
// the component we're testing
import ItemForm from './ItemForm.jsx'
// the api module. Because of jest.mock below, this is the FAKE version
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
// (so one test's mockResolvedValue or calls don't leak into the next test)
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

  // ===================================================================
  // MY TEST 3: submitting the form
  // WHAT IT CHECKS: (1) api.post is called with '/items' and EXACTLY the 5 fields
  //   (no reportedBy), and (2) after saving, the page navigates to /items.
  // WHY IT WORKS: onSubmit in ItemForm.jsx builds
  //   body = { title, status, category, location, description }, calls
  //   api.post('/items', body), then nav('/items').
  // WHAT IF THE FEATURE BREAKS: add reportedBy to the body -> toHaveBeenCalledWith
  //   fails (it compares the WHOLE object). Delete nav('/items') -> "Items page"
  //   never shows up, so findByText fails.
  // ===================================================================
  test('submitting POSTs { title, status, category, location, description } (no reportedBy) and navigates to /items', async () => {
    // ---- ARRANGE ----
    // make the fake api.post SUCCEED (a resolved promise, like axios on 201)
    api.post.mockResolvedValue({ data: { item: {} } })
    // show the Report Item page
    renderAt('/items/new')

    // ---- ACT: fill the form like a real user ----
    // find the title input by its placeholder and type into it
    await userEvent.type(screen.getByPlaceholderText(/title/i), 'Phone')
    // the page has 2 <select>s (role = combobox): the first is status, the second is category
    const [status, category] = screen.getAllByRole('combobox')
    // pick 'found' in status
    await userEvent.selectOptions(status, 'found')
    // pick 'electronics' in category
    await userEvent.selectOptions(category, 'electronics')
    // type the location
    await userEvent.type(screen.getByPlaceholderText(/location/i), 'Cafeteria')
    // type the description (textarea)
    await userEvent.type(screen.getByPlaceholderText(/description/i), 'Black iPhone')
    // click Save, which submits the form and runs onSubmit
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    // ---- ASSERT ----
    // the request was sent exactly once
    expect(api.post).toHaveBeenCalledTimes(1)
    // called with the right URL and EXACTLY this object. toHaveBeenCalledWith
    // compares the whole object, so an extra field (like reportedBy) or a missing one fails the test
    expect(api.post).toHaveBeenCalledWith('/items', {
      title: 'Phone',
      status: 'found',
      category: 'electronics',
      location: 'Cafeteria',
      description: 'Black iPhone'
    })
    // "Items page" only exists on the /items route, so if it shows up, nav('/items') worked.
    // findBy (not getBy) because it WAITS: navigation happens after the await in onSubmit (async)
    expect(await screen.findByText('Items page')).toBeInTheDocument()
  })

  // ===================================================================
  // MY TEST 4: showing the server's error
  // WHAT IT CHECKS: if the server rejects the request (e.g. 409 duplicate), its
  //   message is shown on the page and we DON'T navigate away.
  // WHY IT WORKS: in onSubmit, when api.post fails we jump to the catch, which does
  //   setError(err?.response?.data?.message || 'Save failed'). The error is then
  //   rendered in a <div>, and nav('/items') never runs.
  // WHAT IF THE FEATURE BREAKS: comment out setError in the catch -> the message
  //   never appears, so findByText fails after waiting.
  // ===================================================================
  test('shows the server\'s message when the request fails (e.g. 409) and stays on the page', async () => {
    // ---- ARRANGE ----
    // make the fake api.post FAIL (a rejected promise), in the same shape axios uses:
    // err.response.status and err.response.data.message
    api.post.mockRejectedValue({ response: { status: 409, data: { message: 'Duplicate item at this location' } } })
    // show the page
    renderAt('/items/new')

    // ---- ACT ----
    // type a title
    await userEvent.type(screen.getByPlaceholderText(/title/i), 'Black backpack')
    // type a location
    await userEvent.type(screen.getByPlaceholderText(/location/i), 'Library')
    // click Save -> api.post fails -> catch -> setError(...)
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    // ---- ASSERT ----
    // the server's message shows up. findBy because it appears after the async catch runs
    expect(await screen.findByText('Duplicate item at this location')).toBeInTheDocument()
    // we did NOT navigate: "Items page" is NOT on the page.
    // queryBy (not getBy) because queryBy returns null instead of throwing, which is
    // what we need to check that something is NOT there
    expect(screen.queryByText('Items page')).not.toBeInTheDocument()
    // and we're still on the form: the "Report Item" heading is still there
    expect(screen.getByRole('heading', { name: /report item/i })).toBeInTheDocument()
  })
})
