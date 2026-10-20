import { bootstrapApplication } from '@angular/platform-browser';
import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { App } from './app/app';
import { createAppConfig } from './app/app.config';
import { readRuntimeConfig } from './app/core/config/runtime-config';

registerLocaleData(localeVi);
try {
  const config = readRuntimeConfig(window.__BOILERATE_UI__);
  bootstrapApplication(App, createAppConfig(config)).catch(() => showStartupError());
} catch {
  showStartupError();
}

function showStartupError(): void {
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.textContent =
    'Không thể khởi động ứng dụng. Vui lòng kiểm tra cấu hình hoặc tải lại trang.';
  document.body.replaceChildren(message);
  console.error(
    'Frontend startup failed. Check the public runtime configuration and application setup.',
  );
}
