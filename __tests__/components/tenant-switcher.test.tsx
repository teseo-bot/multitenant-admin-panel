import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select data-testid="select" value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: ({ placeholder }: any) => <option disabled>{placeholder}</option>,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TenantSwitcher } from '../../components/tenant-switcher';
import { useAuthStore } from '../../stores/auth-store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

if (!window.PointerEvent) {
  class PointerEvent extends Event {
    constructor(type: string, props: any = {}) {
      super(type, props);
      Object.assign(this, props);
    }
  }
  (window as any).PointerEvent = PointerEvent;
}
if (!HTMLElement.prototype.hasPointerCapture) {
  HTMLElement.prototype.hasPointerCapture = vi.fn();
}
if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = vi.fn();
}

describe('TenantSwitcher', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient();
    queryClient.invalidateQueries = vi.fn() as any;
    queryClient.cancelQueries = vi.fn().mockResolvedValue(undefined) as any;
    queryClient.removeQueries = vi.fn() as any;
    
    useAuthStore.setState({
      activeTenantId: 'tenant-1',
      operatorId: null,
      tenants: [
        { id: 'tenant-1', name: 'Tenant A', role: 'admin' },
        { id: 'tenant-2', name: 'Tenant B', role: 'user' }
      ]
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TenantSwitcher />
      </QueryClientProvider>
    );
  };

  it('renders null if no tenants exist', () => {
    useAuthStore.setState({ tenants: [] });
    const { container } = renderComponent();
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly with current tenant', () => {
    renderComponent();
    expect(screen.getByTestId('select')).toHaveProperty('value', 'tenant-1');
    expect(screen.getByText('Tenant A')).toBeTruthy();
  });

  it('updates store and clears queries sequentially on change', async () => {
    renderComponent();
    
    const select = screen.getByTestId('select');
    fireEvent.change(select, { target: { value: 'tenant-2' } });
    
    await waitFor(() => {
      expect(queryClient.cancelQueries).toHaveBeenCalled();
      expect(queryClient.removeQueries).toHaveBeenCalled();
      expect(useAuthStore.getState().activeTenantId).toBe('tenant-2');
    });
  });
});
