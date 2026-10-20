import { mkdir, writeFile } from 'node:fs/promises';

const output = new URL('../public/runtime-config.js', import.meta.url);
const license = process.env.PRIMEUI_LICENSE_KEY?.trim();
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await writeFile(
  output,
  `window.__BOILERATE_UI__ = Object.freeze(${JSON.stringify(license ? { primeUiLicense: license } : {})});\n`,
  'utf8',
);
