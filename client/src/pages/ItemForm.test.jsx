
// Frontend tests for the ItemForm page — THIS is the only frontend file you edit.
// Run with: npm test --workspace client

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ItemForm from './ItemForm.jsx'
import { api } from '../api'

// Mock the API so no real server is needed.
jest.mock('../api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn()
  }
}))

// Helper: renders ItemForm at the requested path.
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

// Reset mocks before every test.
beforeEach(() => jest.clearAllMocks())

describe('ItemForm — report mode (/items/new)', () => {

  // Test 1: Check that all fields have their default values.
  test('renders all fields with their default values', () => {
    renderAt('/items/new')

    expect(
      screen.getByRole('heading', { name: /report item/i })
    ).toBeInTheDocument()

    expect(
      screen.getByPlaceholderText(/title/i)
    ).toHaveValue('')

    const [status, category] = screen.getAllByRole('combobox')

    expect(status).toHaveValue('lost')
    expect(category).toHaveValue('other')
  })

  // Test 2: Check successful submission and navigation.
  test('submitting POSTs the correct body and navigates to /items', async () => {
    const user = userEvent.setup()

    api.post.mockResolvedValue({
      data: { item: {} }
    })

    renderAt('/items/new')

    await user.type(
      screen.getByPlaceholderText(/title/i),
      'Black backpack'
    )

    await user.selectOptions(
      screen.getAllByRole('combobox')[0],
      'found'
    )

    await user.selectOptions(
      screen.getAllByRole('combobox')[1],
      'accessories'
    )

    await user.type(
      screen.getByPlaceholderText(/location/i),
      'Library'
    )

    await user.type(
      screen.getByPlaceholderText(/description/i),
      'Black backpack near the entrance'
    )

    await user.click(
      screen.getByRole('button', { name: /save/i })
    )

    expect(api.post).toHaveBeenCalledWith('/items', {
      title: 'Black backpack',
      status: 'found',
      category: 'accessories',
      location: 'Library',
      description: 'Black backpack near the entrance'
    })

    expect(
      await screen.findByText('Items page')
    ).toBeInTheDocument()
  })

  // Test 3: Check that server errors are displayed.
  test('shows the server error and stays on the page', async () => {
    const user = userEvent.setup()

    api.post.mockRejectedValue({
      response: {
        data: {
          message: 'Duplicate item at this location'
        }
      }
    })

    renderAt('/items/new')

    await user.type(
      screen.getByPlaceholderText(/title/i),
      'Black backpack'
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
