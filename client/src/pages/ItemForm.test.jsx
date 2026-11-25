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
  test('renders all fields with their default values', () => {
    renderAt('/items/new')
    expect(screen.getByRole('heading', { name: /report item/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/title/i)).toHaveValue('')
    const [status, category] = screen.getAllByRole('combobox')
    expect(status).toHaveValue('lost')
    expect(category).toHaveValue('other')
  })

  test('submitting POSTs { title, status, category, location, description } (no reportedBy) and navigates to /items', async () => {
    api.post.mockResolvedValue({ data: { item: { _id: '123' } } })
    renderAt('/items/new')

    await userEvent.type(screen.getByPlaceholderText(/title/i), 'Silver keys')
    const [status, category] = screen.getAllByRole('combobox')
    await userEvent.selectOptions(status, 'found')
    await userEvent.selectOptions(category, 'accessories')
    await userEvent.type(screen.getByPlaceholderText(/location/i), 'C building')
    await userEvent.type(screen.getByPlaceholderText(/description/i), 'Keychain with blue tag')

    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByText('Items page')).toBeInTheDocument()
    expect(api.post).toHaveBeenCalledWith('/items', {
      title: 'Silver keys',
      status: 'found',
      category: 'accessories',
      location: 'C building',
      description: 'Keychain with blue tag'
    })
  })

  test("shows the server's message when the request fails (e.g. 409) and stays on the page", async () => {
    api.post.mockRejectedValue({
      response: { status: 409, data: { message: 'Duplicate item at this location' } }
    })
    renderAt('/items/new')

    await userEvent.type(screen.getByPlaceholderText(/title/i), 'Black backpack')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByText('Duplicate item at this location')).toBeInTheDocument()
    expect(screen.queryByText('Items page')).not.toBeInTheDocument()
  })
})
