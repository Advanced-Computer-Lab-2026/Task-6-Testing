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

  test('submitting POSTs the editable fields and navigates to /items', async () => { // Checks the successful report workflow.
    api.post.mockResolvedValue({ data: { item: {} } }) // Makes the fake API report a successful save.
    const user = userEvent.setup() // Creates a user for realistic typing and clicking.
    renderAt('/items/new') // Opens the page in new-report mode.
    await user.type(screen.getByPlaceholderText(/title/i), 'Blue umbrella') // Enters the item's title.
    const [status, category] = screen.getAllByRole('combobox') // Finds the status and category dropdowns.
    await user.selectOptions(status, 'found') // Chooses the item's status.
    await user.selectOptions(category, 'electronics') // Chooses the item's category.
    await user.type(screen.getByPlaceholderText(/location/i), 'Student center') // Enters where it was found.
    await user.type(screen.getByPlaceholderText(/description/i), 'Small blue umbrella') // Enters a description.
    await user.click(screen.getByRole('button', { name: /save/i })) // Submits the completed form.
    expect(api.post).toHaveBeenCalledWith('/items', { // Checks the endpoint and complete request body.
      title: 'Blue umbrella', // Confirms the title is included.
      status: 'found', // Confirms the selected status is included.
      category: 'electronics', // Confirms the selected category is included.
      location: 'Student center', // Confirms the location is included.
      description: 'Small blue umbrella' // Confirms the description is included without reporter data.
    }) // Ends the exact API-call assertion.
    expect(await screen.findByText('Items page')).toBeInTheDocument() // Confirms success navigates to the items page.
  }) // Ends the successful-submit test.

  test('shows the server message when saving fails and stays on the page', async () => { // Checks the failed report workflow.
    api.post.mockRejectedValue({ response: { data: { message: 'Duplicate item at this location' } } }) // Makes the fake API return its duplicate message.
    const user = userEvent.setup() // Creates a user for realistic form interaction.
    renderAt('/items/new') // Opens the page in new-report mode.
    await user.type(screen.getByPlaceholderText(/title/i), 'Blue umbrella') // Enters a title so the form has user input.
    await user.click(screen.getByRole('button', { name: /save/i })) // Submits the form and triggers the fake failure.
    expect(await screen.findByText('Duplicate item at this location')).toBeInTheDocument() // Confirms the server's message is shown.
    expect(screen.queryByText('Items page')).not.toBeInTheDocument() // Confirms a failed save does not navigate away.
  }) // Ends the failed-submit test.
})
