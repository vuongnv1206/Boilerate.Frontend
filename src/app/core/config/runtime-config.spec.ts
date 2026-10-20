import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { readRuntimeConfig } from './runtime-config';
import { provideRuntimeConfig, RUNTIME_CONFIG } from './runtime-config.token';

describe('Public runtime configuration', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('uses the local API default when the optional config file supplies no settings', () => {
    expect(readRuntimeConfig(undefined)).toEqual({ apiBaseUrl: '/api' });
    expect(readRuntimeConfig({})).toEqual({ apiBaseUrl: '/api' });
  });

  it('normalizes the configured API prefix and exposes an immutable DI value', () => {
    const config = readRuntimeConfig({ apiBaseUrl: 'https://api.example.test/v1/' });
    TestBed.configureTestingModule({ providers: [provideRuntimeConfig(config)] });
    expect(TestBed.inject(RUNTIME_CONFIG).apiBaseUrl).toBe('https://api.example.test/v1');
    expect(Object.isFrozen(config)).toBe(true);
    expect(readRuntimeConfig({ apiBaseUrl: '/' }).apiBaseUrl).toBe('/');
  });

  it.each([
    null,
    [],
    'https://api.example.test',
    { apiBaseUrl: '' },
    { apiBaseUrl: null },
    { apiBaseUrl: '//api.example.test' },
    { apiBaseUrl: 'api' },
    { apiBaseUrl: 'https://user:password@api.example.test' },
    { apiBaseUrl: '/api?token=private' },
    { apiBaseUrl: '/api#secret' },
    { apiBaseUrl: '/api/../private' },
    { apiBaseUrl: '/api/%2e%2e/private' },
    { apiBaseUrl: '/api/%5cprivate' },
    { apiBaseUrl: '/api/%' },
    { primeUiLicense: 42 },
    { primeUiLicense: '' },
    { accessToken: 'private' },
  ])('rejects invalid configuration without repeating its contents (%#)', (input) => {
    expect(() => readRuntimeConfig(input)).toThrowError(/Runtime configuration/u);
    try {
      readRuntimeConfig(input);
    } catch (error) {
      expect(String(error)).not.toMatch(/password|token=private|accessToken/u);
    }
  });
});
