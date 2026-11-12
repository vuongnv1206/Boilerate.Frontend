import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const eslint = new ESLint({ cwd });
const screen = 'src/app/modules/catalog/categories/categories-list/categories.component.ts';
const probes = [
  [
    'core rejects module',
    'src/app/core/probe.ts',
    "import '@modules/catalog/catalog.routes';",
    false,
  ],
  [
    'core rejects layout',
    'src/app/core/probe.ts',
    "import '@layout/admin-shell/admin-shell.component';",
    false,
  ],
  [
    'layout rejects module',
    'src/app/layout/probe.ts',
    "import '@modules/catalog/catalog.routes';",
    false,
  ],
  [
    'layout accepts navigation',
    'src/app/layout/probe.ts',
    "import '@core/navigation/workspace-navigation';",
    true,
  ],
  [
    'shared UI rejects module service',
    'src/app/shared/ui/probe.ts',
    "import '@api/catalog/services/categories.service';",
    false,
  ],
  ['shared UI rejects HTTP', 'src/app/shared/ui/probe.ts', "import '@angular/common/http';", false],
  [
    'shared UI accepts sibling',
    'src/app/shared/ui/probe.ts',
    "import './icon/icon.component';",
    true,
  ],
  [
    'app accepts module routes',
    'src/app/probe.ts',
    "void import('./modules/catalog/catalog.routes');",
    true,
  ],
  [
    'app rejects private module screen',
    'src/app/probe.ts',
    "void import('./modules/catalog/categories/categories-list/categories.component');",
    false,
  ],
  ['unknown alias is rejected', 'src/app/core/probe.ts', "import '@models/missing';", false],
  [
    'routes accept module service',
    'src/app/modules/catalog/catalog.routes.ts',
    "import '@api/catalog/services/categories.service';",
    true,
  ],
  [
    'routes accept lazy screen',
    'src/app/modules/catalog/catalog.routes.ts',
    "void import('./categories/categories-list/categories.component');",
    true,
  ],
  [
    'screen accepts module service',
    screen,
    "import '@api/catalog/services/categories.service';",
    true,
  ],
  [
    'screen accepts module model',
    screen,
    "import { CategoryDto } from '@api/catalog/models/category.dto';",
    true,
  ],
  ['screen accepts shared imports', screen, "import '@shared/shared-imports';", true],
  [
    'screen accepts another module component',
    screen,
    "import '@modules/inventory/product-inventory-panel/product-inventory-panel.component';",
    true,
  ],
  ['screen rejects HTTP transport', screen, "import '@core/http/api.service';", false],
  ['screen rejects raw HTTP', screen, "import '@angular/common/http';", false],
  [
    'service accepts transport',
    'src/app/api/catalog/services/probe.service.ts',
    "import '@core/http/api.service';",
    true,
  ],
  [
    'service rejects view',
    'src/app/api/catalog/services/probe.service.ts',
    "import '@modules/catalog/categories/categories-list/categories.component';",
    false,
  ],
  [
    'service rejects router',
    'src/app/api/catalog/services/probe.service.ts',
    "import {Router} from '@angular/router';",
    false,
  ],
  ['utility accepts sibling', 'src/app/shared/utils/probe.ts', "import './date.util';", true],
  [
    'utility rejects DI',
    'src/app/shared/utils/probe.ts',
    "import {inject} from '@angular/core';",
    false,
  ],
  [
    'shared UI rejects auth',
    'src/app/shared/ui/probe.ts',
    "import '@core/auth/auth-session';",
    false,
  ],
  [
    'model rejects view',
    'src/app/api/catalog/models/probe.dto.ts',
    "import '@modules/catalog/categories/categories-list/categories.component';",
    false,
  ],
  [
    'screen rejects UI selector',
    screen,
    "import {Component} from '@angular/core'; @Component({selector:'ui-test',template:''}) export class Test {}",
    false,
  ],
];

for (const [name, filePath, code, allowed] of probes) {
  const results = await eslint.lintText(code, { filePath });
  const errors = results
    .flatMap((result) => result.messages)
    .filter(
      (message) =>
        message.ruleId?.startsWith('boundaries/') ||
        message.ruleId === '@angular-eslint/component-selector' ||
        message.fatal,
    );
  assert.equal(errors.length === 0, allowed, `${name}: ${JSON.stringify(errors)}`);
}

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}

for (const folder of ['core', 'shared', 'layout', 'modules', 'api']) {
  assert.ok(fs.existsSync(path.join(cwd, 'src/app', folder)), `Missing app folder: ${folder}`);
}
for (const legacy of [
  'features',
  'stores',
  'services',
  'models',
  'forms',
  'constants',
  'enums',
  'guards',
  'utils',
]) {
  assert.ok(
    !fs.existsSync(path.join(cwd, 'src/app', legacy)),
    `Legacy folder must not exist: src/app/${legacy}`,
  );
}

for (const file of files(path.join(cwd, 'src/app'))) {
  assert.ok(!file.endsWith('.store.ts'), `Store files are forbidden: ${file}`);
  assert.ok(!file.endsWith('.spec.ts'), `Spec files are forbidden: ${file}`);
  if (!file.endsWith('.ts')) continue;
  assert.match(
    path.basename(file),
    /^[a-z0-9]+(?:[.-][a-z0-9]+)*\.ts$/u,
    `Use kebab-case: ${file}`,
  );
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes('@Component({')) {
    assert.match(
      path.basename(file),
      /\.component\.ts$/u,
      `Component source must end with .component.ts: ${file}`,
    );
    const templateUrl = source.match(/templateUrl:\s*['"]([^'"]+)['"]/u)?.[1];
    if (templateUrl) {
      assert.match(
        templateUrl,
        /\.component\.html$/u,
        `External component template must end with .component.html: ${file}`,
      );
    }
    assert.ok(
      !fs.existsSync(file.replace(/\.ts$/u, '.scss')),
      `Use the shared SCSS boundary: ${file}`,
    );
  }
}

const angular = JSON.parse(fs.readFileSync(path.join(cwd, 'angular.json'), 'utf8'));
const defaults = angular.projects['boilerate-frontend'].schematics['@schematics/angular:component'];
assert.equal(defaults.style, 'none');
assert.equal(defaults.skipTests, true);
assert.equal(defaults.type, 'component');
assert.equal(defaults.addTypeToClassName, false);
console.log(`Architecture: ${probes.length} import checks and screen/style rules passed.`);
