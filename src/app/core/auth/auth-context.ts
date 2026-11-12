import { HttpContextToken } from '@angular/common/http';

/** Set on a request to send it without the access token and without the 401/403 handling. */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);
