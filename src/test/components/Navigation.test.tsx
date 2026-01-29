import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Navigation from '../../components/Navigation/Navigation';

describe('Navigation Component', () => {
  const mockOnPageChange = vi.fn();

  beforeEach(() => {
    mockOnPageChange.mockClear();
  });

  it('renders navigation buttons correctly', () => {
    render(<Navigation currentPage="new" onPageChange={mockOnPageChange} />);
    
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('highlights active page correctly', () => {
    render(<Navigation currentPage="new" onPageChange={mockOnPageChange} />);
    
    const newButton = screen.getByText('New').closest('button');
    const savedButton = screen.getByText('Saved').closest('button');
    
    expect(newButton).toHaveClass('bg-blue-600', 'text-white');
    expect(savedButton).not.toHaveClass('bg-blue-600');
  });

  it('calls onPageChange when buttons are clicked', () => {
    render(<Navigation currentPage="new" onPageChange={mockOnPageChange} />);
    
    fireEvent.click(screen.getByText('Saved'));
    expect(mockOnPageChange).toHaveBeenCalledWith('saved');
    
    fireEvent.click(screen.getByText('New'));
    expect(mockOnPageChange).toHaveBeenCalledWith('new');
  });
});