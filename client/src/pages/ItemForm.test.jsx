
// Frontend tests for the ItemForm page — THIS is the only frontend file you edit.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ItemForm from './ItemForm.jsx';
import { api } from '../api';

// Replace the real API with fake functions.
jest.mock('../api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn()
  }
}));

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
  );
}

// Reset mocks before every test.
beforeEach(() => jest.clearAllMocks());

describe('ItemForm — report mode (/items/new)', () => {

  // Example test
  test('renders all fields with their default values', () => {
    renderAt('/items/new');

    expect(
      screen.getByRole('heading', { name: /report item/i })
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(/title/i)
    ).toHaveValue('');

    const [status, category] = screen.getAllByRole('combobox');

    expect(status).toHaveValue('lost');
    expect(category).toHaveValue('other');
  });

  // Test 1: Successful form submission.
  test('submitting POSTs the correct item data and navigates to /items', async () => {
    const user = userEvent.setup();

    // Make the fake API request succeed.
    api.post.mockResolvedValueOnce({
      data: { item: {} }
    });

    renderAt('/items/new');

    // Find and fill in the form fields.
    await user.type(
      screen.getByPlaceholderText(/title/i),
      'Lost laptop'
    );

    const [status, category] = screen.getAllByRole('combobox');

    await user.selectOptions(status, 'found');
    await user.selectOptions(category, 'electronics');

    await user.type(
      screen.getByPlaceholderText(/location/i),
      'Computer Lab'
    );

    await user.type(
      screen.getByPlaceholderText(/description/i),
      'Silver laptop'
    );

    // Submit the form.
    await user.click(screen.getByRole('button', { name: /save/i }));

    // Check that the API received the correct URL and data.
    expect(api.post).toHaveBeenCalledWith('/items', {
      title: 'Lost laptop',
      status: 'found',
      category: 'electronics',
      location: 'Computer Lab',
      description: 'Silver laptop'
    });

    // Check that navigation happened after successful submission.
    expect(await screen.findByText('Items page')).toBeInTheDocument();
  });

  // Test 2: Failed form submission.
  test('shows the server error message and stays on the page', async () => {
    const user = userEvent.setup();

    // Make the fake API request fail with a duplicate-item error.
    api.post.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Duplicate item at this location'
        }
      }
    });

    renderAt('/items/new');

    // Fill in the title and submit.
    await user.type(
      screen.getByPlaceholderText(/title/i),
      'Lost phone'
    );

    await user.click(screen.getByRole('button', { name: /save/i }));

    // Check that the server's error message appears.
    expect(
      await screen.findByText('Duplicate item at this location')
    ).toBeInTheDocument();

    // Check that the user was NOT redirected to the items page.
    expect(screen.queryByText('Items page')).not.toBeInTheDocument();

    // The report form should still be visible.
    expect(
      screen.getByRole('heading', { name: /report item/i })
    ).toBeInTheDocument();
  });

});
