export interface DiscountDto {
  readonly id: string;
  readonly version: string;
  readonly code: string;
  readonly name: string;
  readonly kind: 1 | 2;
  readonly value: number;
  readonly minimumSubtotal: number;
  readonly startsAtUtc: string | null;
  readonly endsAtUtc: string | null;
  readonly usageLimit: number | null;
  readonly usedCount: number;
  readonly isActive: boolean;
}

export type SaveDiscountRequest = Omit<DiscountDto, 'id' | 'version' | 'usedCount'>;
export interface DiscountPage {
  readonly items: readonly DiscountDto[];
  readonly total: number;
  readonly pageNumber: number;
  readonly pageSize: number;
}
