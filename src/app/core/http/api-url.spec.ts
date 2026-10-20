import { describe, expect, it } from 'vitest';
import { apiUrl, isApiRequestUrl } from './api-url';

describe('API URL construction', () => {
  it('keeps resource paths below relative and absolute API prefixes', () => {
    expect(apiUrl('/api/', 'users/42')).toBe('/api/users/42');
    expect(apiUrl('https://api.example.test/v1', 'users')).toBe(
      'https://api.example.test/v1/users',
    );
    expect(apiUrl('/', 'users')).toBe('/users');
    expect(apiUrl('/api', '')).toBe('/api');
  });

  it.each([
    'https://other.test/users',
    '//other.test',
    '/users',
    '../users',
    'a/../users',
    '%2e%2e/users',
    '%2fusers',
    'a\\users',
    'users?token=x',
    'users#x',
    'users/%',
  ])('rejects a resource that bypasses or corrupts the base: %s', (path) => {
    expect(() => apiUrl('/api', path)).toThrow();
  });

  it('matches only the configured API origin and complete path prefix', () => {
    const documentUrl = 'https://admin.example.test/admin/';
    expect(isApiRequestUrl('/api/users?q=one', '/api', documentUrl)).toBe(true);
    expect(isApiRequestUrl('https://admin.example.test/api', '/api', documentUrl)).toBe(true);
    expect(isApiRequestUrl('/api-backup/users', '/api', documentUrl)).toBe(false);
    expect(isApiRequestUrl('/images/logo.svg', '/api', documentUrl)).toBe(false);
    expect(isApiRequestUrl('https://other.test/api/users', '/api', documentUrl)).toBe(false);
    expect(
      isApiRequestUrl(
        'https://api.example.test/v1/users',
        'https://api.example.test/v1',
        documentUrl,
      ),
    ).toBe(true);
  });
});
