export interface GuestPaymentSettings {
  readonly bankName: string | null;
  readonly accountNumber: string | null;
  readonly accountHolder: string | null;
  readonly branch: string | null;
  readonly instructions: string | null;
  readonly bankTransferEnabled: boolean;
  readonly shopName?: string | null;
  readonly contactEmail?: string | null;
  readonly contactPhone?: string | null;
  readonly flatShippingAmount?: number | null;
  readonly reservationMinutes?: number | null;
}

export interface StorefrontSettings extends GuestPaymentSettings {
  readonly version: string;
}

export type UpdateStorefrontSettings = Omit<StorefrontSettings, 'version'> & {
  readonly version: string;
};
