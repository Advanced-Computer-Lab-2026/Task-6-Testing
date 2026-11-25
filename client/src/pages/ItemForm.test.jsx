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

  test('submitting POSTs the editable fields without reportedBy and navigates to /items', async () => { // Checks the README's successful report submission behavior.
    const user = userEvent.setup() // Creates a user-event driver for realistic typing and clicking.
    api.post.mockResolvedValue({ data: { item: {} } }) // Makes the mocked API report a successful save.
    renderAt('/items/new') // Renders the form in new-report mode.
    await user.type(screen.getByPlaceholderText(/title/i), 'Blue umbrella') // Enters the item title.
    await user.selectOptions(screen.getAllByRole('combobox')[0], 'found') // Chooses the item's found status.
    await user.selectOptions(screen.getAllByRole('combobox')[1], 'electronics') // Chooses the electronics category.
    await user.type(screen.getByPlaceholderText(/location/i), 'Cafeteria') // Enters where the item was found.
    await user.type(screen.getByPlaceholderText(/description/i), 'Left on a chair') // Enters the item's description.
    await user.click(screen.getByRole('button', { name: /save/i })) // Submits the completed report form.
    expect(api.post).toHaveBeenCalledWith('/items', { title: 'Blue umbrella', status: 'found', category: 'electronics', location: 'Cafeteria', description: 'Left on a chair' }) // Verifies the exact API path and body contain the five allowed fields only.
    expect(await screen.findByText('Items page')).toBeInTheDocument() // Waits for and verifies navigation to the items page after saving.
  }) // Ends the successful-submission test.
  test('shows the server message when the request fails and stays on the page', async () => { // Checks the README's server-error display and no-navigation behavior.
    const user = userEvent.setup() // Creates a user-event driver for realistic form interaction.
    api.post.mockRejectedValue({ response: { data: { message: 'Duplicate item at this location' } } }) // Makes the mocked API return the duplicate-report error from the README.
    renderAt('/items/new') // Renders the form in new-report mode.
    await user.type(screen.getByPlaceholderText(/title/i), 'Black backpack') // Enters a title before submitting.
    await user.type(screen.getByPlaceholderText(/location/i), 'Library') // Enters a location before submitting.
    await user.click(screen.getByRole('button', { name: /save/i })) // Submits the form to receive the mocked server error.
    expect(await screen.findByText('Duplicate item at this location')).toBeInTheDocument() // Waits for and verifies that the server's message is displayed.
    expect(screen.getByRole('heading', { name: /report item/i })).toBeInTheDocument() // Verifies the report form remains visible after the error.
    expect(screen.queryByText('Items page')).not.toBeInTheDocument() // Verifies the failed save did not navigate to the items page.
  }) // Ends the server-error test.
})
