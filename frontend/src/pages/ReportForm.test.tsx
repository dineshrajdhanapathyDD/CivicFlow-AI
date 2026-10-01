import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReportForm from './ReportForm.js';

function renderForm() {
  return render(
    <MemoryRouter>
      <ReportForm />
    </MemoryRouter>,
  );
}

describe('ReportForm', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the core form fields', () => {
    renderForm();
    expect(screen.getByLabelText(/short description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/details/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit report/i })).toBeInTheDocument();
  });

  it('disables submit until text or title is entered', () => {
    renderForm();
    const submit = screen.getByRole('button', { name: /submit report/i });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/short description/i), {
      target: { value: 'Streetlight out near school' },
    });
    expect(submit).not.toBeDisabled();
  });

  it('rejects an image with a disallowed type', () => {
    renderForm();
    const fileInput = screen.getByLabelText(/photo/i) as HTMLInputElement;
    const badFile = new File(['x'], 'notes.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [badFile] } });
    expect(screen.getByText(/jpeg, png, or webp/i)).toBeInTheDocument();
  });

  it('rejects an image larger than 8 MB', () => {
    renderForm();
    const fileInput = screen.getByLabelText(/photo/i) as HTMLInputElement;
    const bigFile = new File([new Uint8Array(9 * 1024 * 1024)], 'big.jpg', {
      type: 'image/jpeg',
    });
    fireEvent.change(fileInput, { target: { files: [bigFile] } });
    expect(screen.getByText(/too large/i)).toBeInTheDocument();
  });
});
