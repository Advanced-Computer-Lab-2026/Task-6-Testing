import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ItemForm from './ItemForm.jsx'
import { api } from '../api'

jest.mock('../api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn()
  }
}))

function renderAt(path) {
  return render(
    <MemoryRouter
      initialEntries={[path]}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
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

  // Test 1: Default form values.
  test('renders all fields with their default values', () => {
    renderAt('/items/new')

    expect(
      screen.getByRole('heading', { name: /report item/i })
    ).toBeInTheDocument()

    expect(screen.getByPlaceholderText(/title/i)).toHaveValue('')

    const [status, category] = screen.getAllByRole('combobox')

    expect(status).toHaveValue('lost')
    expect(category).toHaveValue('other')
  })

  // Test 2: Successful submission.
  test('submits the correct payload and navigates to /items', async () => {
    api.post.mockResolvedValue({
      data: { item: {} }
    })

    renderAt('/items/new')

    const user = userEvent.setup()

    await user.type(
      screen.getByPlaceholderText(/title/i),
      'Black backpack'
    )

    const [status, category] = screen.getAllByRole('combobox')

    await user.selectOptions(status, 'found')
    await user.selectOptions(category, 'accessories')

    await user.type(
      screen.getByPlaceholderText(/location/i),
      'Library'
    )

    await user.type(
      screen.getByPlaceholderText(/description/i),
      'Black backpack with books'
    )

    await user.click(
      screen.getByRole('button', { name: /save/i })
    )

    expect(api.post).toHaveBeenCalledWith('/items', {
      title: 'Black backpack',
      status: 'found',
      category: 'accessories',
      location: 'Library',
      description: 'Black backpack with books'
    })

    expect(
      await screen.findByText('Items page')
    ).toBeInTheDocument()
  })

  // Test 3: Failed submission.
  test('shows the server error and stays on the report page', async () => {
    api.post.mockRejectedValue({
      response: {
        data: {
          message: 'Duplicate item at this location'
        }
      }
    })

    renderAt('/items/new')

    const user = userEvent.setup()

    await user.type(
      screen.getByPlaceholderText(/title/i),
      'Black backpack'
    )

    await user.type(
      screen.getByPlaceholderText(/location/i),
      'Library'
    )

    await user.click(
      screen.getByRole('button', { name: /save/i })
    )

    expect(
      await screen.findByText('Duplicate item at this location')
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', { name: /report item/i })
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Items page')
    ).not.toBeInTheDocument()
  })

})