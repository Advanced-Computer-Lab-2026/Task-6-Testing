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

    test('submitting POSTs (no reportedBy) and navigates to /items', async () => {
    // Arrange: make the fake API succeed, then render the form
    api.post.mockResolvedValue({ data: { item: { _id: '1' } } }) //fake API returns a new item
    renderAt('/items/new')  // open the Report Item page

    // Act: fill in the fields and click Save
    await userEvent.type(screen.getByPlaceholderText(/title/i), 'Keys') //Types the title of item
    const [status, category] = screen.getAllByRole('combobox')  //get the 2 dropdowns
    await userEvent.selectOptions(status, 'found')  //Selects the status of item
    await userEvent.selectOptions(category, 'accessories') //Selects the category of item
    await userEvent.type(screen.getByPlaceholderText(/location/i), 'Cafeteria') //Types the location of item
    await userEvent.type(screen.getByPlaceholderText(/description/i), 'Silver keyring') //Types the description of item
    await userEvent.click(screen.getByRole('button', { name: /save/i })) //Clicks the save button

    // Assert: we reached /items, and the right data was sent
    expect(await screen.findByText('Items page')).toBeInTheDocument()
    expect(api.post).toHaveBeenCalledWith('/items', { //checks the URL and data
      title: 'Keys',
      status: 'found',
      category: 'accessories',
      location: 'Cafeteria',
      description: 'Silver keyring',
    })
  })

    test('shows the server\'s message when the request fails and stays on the page', async () => {
    // Arrange: make the fake API fail, then render the form
    api.post.mockRejectedValue({   // fake API returns a 409 error
      response: { data: { message: 'Duplicate item at this location' } },
    })
    renderAt('/items/new')  // open the Report Item page

    // Act: fill in the fields and click Save
    await userEvent.type(screen.getByPlaceholderText(/title/i), 'Keys') //Types the title of item
    await userEvent.type(screen.getByPlaceholderText(/location/i), 'Cafeteria') //Types the location of item
    await userEvent.click(screen.getByRole('button', { name: /save/i })) //Clicks the save button

    // Assert: the error is shown and we are still on the form
    expect(await screen.findByText('Duplicate item at this location')).toBeInTheDocument() //checks for the error message
    expect(screen.getByRole('heading', { name: /report item/i })).toBeInTheDocument() //checks that we are still on the report item page
    expect(screen.queryByText('Items page')).not.toBeInTheDocument() //checks that we are not on the items page
  })

  //test.todo('submitting POSTs { title, status, category, location, description } (no reportedBy) and navigates to /items')
  //test.todo('shows the server\'s message when the request fails (e.g. 409) and stays on the page')
})
