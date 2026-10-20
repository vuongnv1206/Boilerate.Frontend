import { bootstrapApplication } from '@angular/platform-browser';
import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { App } from './app/app';
import { appConfig } from './app/app.config';

registerLocaleData(localeVi);
bootstrapApplication(App, appConfig).catch((error: unknown) => console.error(error));
