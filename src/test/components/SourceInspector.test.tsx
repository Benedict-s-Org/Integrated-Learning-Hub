import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SourceInspector from '../../components/SourceInspector/SourceInspector';

// Mock window dimensions
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 768,
});

describe('SourceInspector Component', () => {
  it('renders detection mode toggle button', () => {
    render(<SourceInspector />);
    
    expect(screen.getByText('Detection Mode')).toBeInTheDocument();
  });

  it('toggles detection mode when button is clicked', () => {
    render(<SourceInspector />);
    
    const toggleButton = screen.getByText('Detection Mode');
    fireEvent.click(toggleButton);
    
    expect(screen.getByText('Exit Detection')).toBeInTheDocument();
    expect(screen.getByText('Detection Mode Active')).toBeInTheDocument();
  });

  it('shows source info on hover when detection mode is active', () => {
    render(
      <div>
        <SourceInspector />
        <div data-source-tsx="TestComponent|src/test/TestComponent.tsx">
          Test Element
        </div>
      </div>
    );
    
    // Enable detection mode
    fireEvent.click(screen.getByText('Detection Mode'));
    
    // Hover over element with data-source-tsx
    const testElement = screen.getByText('Test Element');
    fireEvent.mouseMove(testElement, { clientX: 100, clientY: 100 });
    
    expect(screen.getByText('Component Source')).toBeInTheDocument();
    expect(screen.getByText('TestComponent')).toBeInTheDocument();
  });

  it('pins source info when clicked', () => {
    render(
      <div>
        <SourceInspector />
        <div data-source-tsx="TestComponent|src/test/TestComponent.tsx">
          Test Element
        </div>
      </div>
    );
    
    // Enable detection mode
    fireEvent.click(screen.getByText('Detection Mode'));
    
    // Hover and click to pin
    const testElement = screen.getByText('Test Element');
    fireEvent.mouseMove(testElement, { clientX: 100, clientY: 100 });
    fireEvent.click(testElement);
    
    expect(screen.getByText('Pinned - Click X to unpin')).toBeInTheDocument();
  });
});