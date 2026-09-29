import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import TextInput from '../../components/TextInput/TextInput';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

describe('TextInput Component', () => {
  const mockOnNext = vi.fn();

  beforeEach(() => {
    mockOnNext.mockClear();
  });

  it('renders text input form correctly', () => {
    render(<TextInput onNext={mockOnNext} />);
    
    expect(screen.getByText('Enter Your Text')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter a title or topic for this paragraph...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your paragraph here...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  it('disables next button when text is empty', () => {
    render(<TextInput onNext={mockOnNext} />);
    
    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toBeDisabled();
  });

  it('enables next button when text is entered', async () => {
    const user = userEvent.setup();
    render(<TextInput onNext={mockOnNext} />);
    
    const textarea = screen.getByPlaceholderText('Enter your paragraph here...');
    const nextButton = screen.getByRole('button', { name: /next/i });
    
    await user.type(textarea, 'Sample text for testing');
    
    expect(nextButton).not.toBeDisabled();
  });

  it('calls onNext with trimmed text when form is submitted', async () => {
    const user = userEvent.setup();
    render(<TextInput onNext={mockOnNext} />);
    
    const textarea = screen.getByPlaceholderText('Enter your paragraph here...');
    
    await user.type(textarea, '  Sample text  ');
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    
    expect(mockOnNext).toHaveBeenCalledWith('Sample text');
  });

  it('calls onNext with trimmed text and title when title is provided', async () => {
    const user = userEvent.setup();
    render(<TextInput onNext={mockOnNext} />);
    
    const titleInput = screen.getByPlaceholderText('Enter a title or topic for this paragraph...');
    const textarea = screen.getByPlaceholderText('Enter your paragraph here...');
    
    await user.type(titleInput, '  My Story Title  ');
    await user.type(textarea, '  Sample paragraph content  ');
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    
    expect(mockOnNext).toHaveBeenCalledWith('Sample paragraph content', 'My Story Title');
  });
});