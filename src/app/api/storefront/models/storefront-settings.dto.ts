export interface GuestPaymentSettings {
  readonly bankName: string | null;
  readonly accountNumber: string | null;
  readonly accountHolder: string | null;
  readonly branch: string | null;
  readonly instructions: string | null;
  readonly bankTransferEnabled: boolean;
}

export interface StorefrontSettings extends GuestPaymentSettings {
  readonly version: string;
}

export type StorefrontSettingsDto = StorefrontSettings;

export type UpdateStorefrontSettings = Omit<StorefrontSettings, 'version'> & {
  readonly version: string;
};

export interface StorefrontSettingsFormValue {
  readonly bankTransferEnabled: boolean;
  readonly bankName: string;
  readonly accountNumber: string;
  readonly accountHolder: string;
  readonly branch: string;
  readonly instructions: string;
}
