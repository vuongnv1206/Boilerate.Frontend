export type DiscountKind = 1 | 2;

export type DiscountActiveFilter = 'all' | 'true' | 'false';

export interface DiscountDto {
  readonly id: string;
  readonly version: string;
  readonly code: string;
  readonly name: string;
  readonly kind: DiscountKind;
  readonly value: number;
  readonly minimumSubtotal: number;
  readonly startsAtUtc: string | null;
  readonly endsAtUtc: string | null;
  readonly usageLimit: number | null;
  readonly usedCount: number;
  readonly isActive: boolean;
}

export type SaveDiscountRequest = Omit<DiscountDto, 'id' | 'version' | 'usedCount'>;

export interface UpdateDiscountRequest extends SaveDiscountRequest {
  readonly version: string;
}

export interface DiscountListFilter {
  readonly page: number;
  readonly size?: number;
  readonly search?: string;
  readonly isActive?: boolean | null;
}

export interface DiscountPage {
  readonly items: readonly DiscountDto[];
  readonly total: number;
  readonly pageNumber: number;
  readonly pageSize: number;
}

export const DISCOUNT_KIND_OPTIONS: ReadonlyArray<{
  readonly label: string;
  readonly value: DiscountKind;
}> = [
  { label: 'Phần trăm', value: 1 },
  { label: 'Số tiền cố định', value: 2 },
];

export const DISCOUNT_STATUS_OPTIONS: ReadonlyArray<{
  readonly label: string;
  readonly value: DiscountActiveFilter;
}> = [
  { label: 'Tất cả trạng thái', value: 'all' },
  { label: 'Đang bật', value: 'true' },
  { label: 'Đã tắt', value: 'false' },
];

export const DISCOUNT_FIELD_ALIASES: Readonly<Record<string, string>> = {
  startsAtUtc: 'startsAt',
  endsAtUtc: 'endsAt',
};
