import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { ApiError } from './api-error';
import { normalizeApiError } from './normalize-api-error';

describe('API error normalization', () => {
  it('reads ProblemDetails extensions without exposing raw server details', () => {
    const error = normalizeApiError(
      new HttpErrorResponse({
        status: 400,
        error: {
          title: 'Raw database exception',
          detail: 'Private customer information',
          extensions: {
            code: 'Validation.Error',
            traceId: 'trace:001',
            errors: { Name: ['Tên không hợp lệ.'], 'Address.City': 'Chọn thành phố.' },
          },
        },
      }),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe('validation');
    expect(error.code).toBe('Validation.Error');
    expect(error.traceId).toBe('trace:001');
    expect(error.fieldErrors['Name']).toEqual(['Tên không hợp lệ.']);
    expect(error.fieldErrors['Address.City']).toEqual(['Chọn thành phố.']);
    expect(error.message).not.toMatch(/Raw|Private/u);
    expect(Object.hasOwn(error, 'detail')).toBe(false);
  });

  it('supports flattened ASP.NET ProblemDetails and ignores invalid validation entries', () => {
    const error = normalizeApiError(
      new HttpErrorResponse({
        status: 422,
        error: {
          code: 'InvalidField',
          traceId: '00-abc-123',
          errors: { Name: ['  Lỗi hợp lệ.  ', null, 2, ''], Price: 123, Other: {} },
        },
      }),
    );
    expect(error.fieldErrors).toEqual({ Name: ['Lỗi hợp lệ.'] });
    expect(error.code).toBe('InvalidField');
    expect(error.traceId).toBe('00-abc-123');
    expect(Object.isFrozen(error.fieldErrors['Name'])).toBe(true);
  });

  it.each([
    [0, 'network'],
    [400, 'validation'],
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not-found'],
    [409, 'conflict'],
    [429, 'rate-limit'],
    [500, 'server'],
    [503, 'server'],
    [418, 'unexpected'],
  ])('maps HTTP %i with an empty body to %s', (status, kind) => {
    const error = normalizeApiError(new HttpErrorResponse({ status: Number(status) }));
    expect(error.status).toBe(status);
    expect(error.kind).toBe(kind);
    expect(error.message.length).toBeGreaterThan(10);
  });

  it.each(['<html>Proxy error with secret</html>', ['not', 'a', 'problem'], null, 42])(
    'handles malformed and non-JSON responses (%#)',
    (body) => {
      const error = normalizeApiError(new HttpErrorResponse({ status: 500, error: body }));
      expect(error.kind).toBe('server');
      expect(error.message).not.toContain('secret');
      expect(error.fieldErrors).toEqual({});
    },
  );

  it('does not carry server field errors on a server failure or unsafe correlation values', () => {
    const error = normalizeApiError(
      new HttpErrorResponse({
        status: 500,
        error: {
          code: '<script>secret</script>',
          traceId: 'customer@example.test',
          errors: { Name: ['raw database exception'] },
        },
      }),
    );
    expect(error.code).toBeUndefined();
    expect(error.traceId).toBeUndefined();
    expect(error.fieldErrors).toEqual({});
  });

  it('handles unknown thrown errors and leaves an already normalized error intact', () => {
    const error = normalizeApiError(new Error('private internal exception'));
    expect(error.status).toBe(-1);
    expect(error.kind).toBe('unexpected');
    expect(error.message).not.toContain('private');
    expect(normalizeApiError(error)).toBe(error);
  });
});
