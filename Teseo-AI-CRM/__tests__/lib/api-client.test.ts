import { describe, it, expect, vi, beforeEach } from 'vitest';

import { apiFetch } from '../../lib/api-client';
import { useAuthStore } from '../../stores/auth-store';

global.fetch = vi.fn(() => Promise.resolve(new Response()));

describe('apiFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ activeTenantId: null, operatorId: null, tenants: [] });
  });

  it('should not add x-tenant-id if activeTenantId is null', async () => {
    await apiFetch('https://api.example.com/data');
    
    const callArgs = (global.fetch as any).mock.calls[0];
    const headers = callArgs[1].headers as Headers;
    expect(headers.has('x-tenant-id')).toBe(false);
  });

  it('should throw an error if activeTenantId is not in authorized tenants array', async () => {
    useAuthStore.setState({ 
      activeTenantId: 'tenant-123',
      tenants: [{ id: 'tenant-456', name: 'Other Tenant', role: 'admin' }]
    });
    
    await expect(apiFetch('https://api.example.com/data')).rejects.toThrow('Unauthorized: Invalid tenant ID');
  });

  it('should add x-tenant-id if activeTenantId is present and valid', async () => {
    useAuthStore.setState({ 
      activeTenantId: 'tenant-123',
      tenants: [{ id: 'tenant-123', name: 'Valid Tenant', role: 'admin' }]
    });
    
    await apiFetch('https://api.example.com/data');
    
    const callArgs = (global.fetch as any).mock.calls[0];
    const headers = callArgs[1].headers as Headers;
    expect(headers.get('x-tenant-id')).toBe('tenant-123');
  });

  it('should preserve existing headers when tenant is valid', async () => {
    useAuthStore.setState({ 
      activeTenantId: 'tenant-123',
      tenants: [{ id: 'tenant-123', name: 'Valid Tenant', role: 'admin' }]
    });
    
    await apiFetch('https://api.example.com/data', {
      headers: {
        'Authorization': 'Bearer token'
      }
    });
    
    const callArgs = (global.fetch as any).mock.calls[0];
    const headers = callArgs[1].headers as Headers;
    expect(headers.get('x-tenant-id')).toBe('tenant-123');
    expect(headers.get('Authorization')).toBe('Bearer token');
  });
});
