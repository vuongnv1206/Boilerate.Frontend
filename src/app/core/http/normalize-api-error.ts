import { HttpErrorResponse } from '@angular/common/http';
import { ApiError, ApiErrorKind, ApiFieldErrors } from './api-error';

const ERROR_MESSAGES: Record<ApiErrorKind, string> = {
  network: 'Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại.',
  validation: 'Thông tin chưa hợp lệ. Vui lòng kiểm tra các trường được đánh dấu.',
  unauthorized: 'Phiên làm việc chưa được xác thực. Vui lòng đăng nhập lại.',
  forbidden: 'Bạn không có quyền thực hiện thao tác này.',
  'not-found': 'Không tìm thấy dữ liệu được yêu cầu.',
  conflict: 'Dữ liệu đã thay đổi hoặc thao tác xung đột. Vui lòng tải lại để kiểm tra.',
  'rate-limit': 'Có quá nhiều yêu cầu. Vui lòng đợi một lúc rồi thử lại.',
  server: 'Máy chủ chưa thể xử lý yêu cầu. Vui lòng thử lại sau.',
  unexpected: 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.',
};

/** Treats every payload as untrusted; server detail/title is never the default UI message. */
export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const status = error instanceof HttpErrorResponse ? error.status : -1;
  const body = error instanceof HttpErrorResponse ? asRecord(error.error) : undefined;
  const extensions = asRecord(body?.['extensions']);
  const kind = errorKind(status);
  return new ApiError({
    status,
    kind,
    message: ERROR_MESSAGES[kind],
    code: identifier(body?.['code']) ?? identifier(extensions?.['code']),
    traceId: identifier(body?.['traceId']) ?? identifier(extensions?.['traceId']),
    fieldErrors:
      kind === 'validation'
        ? readFieldErrors(body?.['errors'] ?? extensions?.['errors'])
        : Object.freeze({}),
  });
}

function errorKind(status: number): ApiErrorKind {
  switch (status) {
    case 0:
      return 'network';
    case 400:
    case 422:
      return 'validation';
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'not-found';
    case 409:
      return 'conflict';
    case 429:
      return 'rate-limit';
    default:
      return status >= 500 && status <= 599 ? 'server' : 'unexpected';
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function identifier(value: unknown): string | undefined {
  return typeof value === 'string' && /^[\w.:-]{1,128}$/u.test(value) ? value : undefined;
}

function readFieldErrors(value: unknown): ApiFieldErrors {
  const record = asRecord(value);
  const fields: Record<string, readonly string[]> = Object.create(null) as Record<
    string,
    readonly string[]
  >;
  for (const [field, messages] of Object.entries(record ?? {}).slice(0, 100)) {
    if (!field || field.length > 200 || ['__proto__', 'constructor', 'prototype'].includes(field))
      continue;
    const candidates =
      typeof messages === 'string' ? [messages] : Array.isArray(messages) ? messages : [];
    const safeMessages = candidates
      .filter(
        (message): message is string => typeof message === 'string' && Boolean(message.trim()),
      )
      .slice(0, 5)
      .map((message) => message.trim().slice(0, 500));
    if (safeMessages.length) fields[field] = Object.freeze(safeMessages);
  }
  return Object.freeze(fields);
}
