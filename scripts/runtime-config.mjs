import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const output = new URL('../public/runtime-config.js', import.meta.url);
const localEnv = new URL('../.env.local', import.meta.url);
// Local values fill missing settings; an explicit shell/CI value always wins.
if (existsSync(localEnv)) {
  const existing = { ...process.env };
  process.loadEnvFile(fileURLToPath(localEnv));
  Object.assign(process.env, existing);
}
const license = process.env.PRIMEUI_LICENSE_KEY?.trim();
const apiBaseUrl = process.env.API_BASE_URL ?? '/api';
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await writeFile(
  output,
  `window.__BOILERATE_UI__ = Object.freeze(${JSON.stringify({ apiBaseUrl, ...(license ? { primeUiLicense: license } : {}) })});\n`,
  'utf8',
);
