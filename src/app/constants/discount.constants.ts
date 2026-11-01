export const DISCOUNT_KIND_OPTIONS = [
  { label: 'Phần trăm', value: 1 },
  { label: 'Số tiền cố định', value: 2 },
] as const;

export const DISCOUNT_STATUS_OPTIONS = [
  { label: 'Tất cả trạng thái', value: 'all' },
  { label: 'Đang bật', value: 'true' },
  { label: 'Đã tắt', value: 'false' },
] as const;
