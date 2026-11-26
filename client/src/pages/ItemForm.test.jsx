import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ItemForm from './ItemForm.jsx'
import { api } from '../api'

jest.mock('../api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() }
}))

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

beforeEach(() => jest.clearAllMocks())

describe('ItemForm — report mode (/items/new)', () => {

  // Original example test
  test('renders all fields with their default values', () => {
    renderAt('/items/new')

    expect(screen.getByRole('heading', { name: /report item/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/title/i)).toHaveValue('')

    const [status, category] = screen.getAllByRole('combobox')

    expect(status).toHaveValue('lost')
    expect(category).toHaveValue('other')
  })

  // Test 1: Successful form submission
  test('submits the correct item data and navigates to /items', async () => {

    // Arrange
    api.post.mockResolvedValue({ data: { item: {} } })
    renderAt('/items/new')
    const user = userEvent.setup()

    // Act
    await user.type(screen.getByPlaceholderText(/title/i), 'Phone')

    const [status, category] = screen.getAllByRole('combobox')

    await user.selectOptions(status, 'found')
    await user.selectOptions(category, 'electronics')

    await user.type(screen.getByPlaceholderText(/location/i), 'Library')
    await user.type(screen.getByPlaceholderText(/description/i), 'Black phone')

    await user.click(screen.getByRole('button', { name: /save/i }))

    // Assert
    expect(api.post).toHaveBeenCalledWith('/items', {
      title: 'Phone',
      status: 'found',
      category: 'electronics',
      location: 'Library',
      description: 'Black phone'
    })

    expect(await screen.findByText('Items page')).toBeInTheDocument()
  })

  // Test 2: Server error handling
  test('shows the server error message and stays on the form', async () => {

    // Arrange
    api.post.mockRejectedValue({
      response: {
        data: {
          message: 'Duplicate item at this location'
        }
      }
    })

    renderAt('/items/new')
    const user = userEvent.setup()

    // Act
    await user.type(screen.getByPlaceholderText(/title/i), 'Phone')
    await user.type(screen.getByPlaceholderText(/location/i), 'Library')

    await user.click(screen.getByRole('button', { name: /save/i }))

    // Assert
    expect(await screen.findByText('Duplicate item at this location')).toBeInTheDocument()

    expect(screen.queryByText('Items page')).not.toBeInTheDocument()

    expect(screen.getByRole('heading', { name: /report item/i })).toBeInTheDocument()
  })

})