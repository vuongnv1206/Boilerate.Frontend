import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const eslint = new ESLint({ cwd });
const screen = 'src/app/features/collections/categories/categories.component.ts';
const probes = [
  [
    'core rejects feature',
    'src/app/core/probe.ts',
    "import '@features/collections/collections.routes';",
    false,
  ],
  ['core rejects store', 'src/app/core/probe.ts', "import '@stores/categories.store';", false],
  [
    'core rejects layout',
    'src/app/core/probe.ts',
    "import '@layout/admin-shell/admin-shell.component';",
    false,
  ],
  [
    'layout rejects feature',
    'src/app/layout/probe.ts',
    "import '@features/collections/collections.routes';",
    false,
  ],
  [
    'layout accepts navigation',
    'src/app/layout/probe.ts',
    "import '@core/navigation/workspace-navigation';",
    true,
  ],
  [
    'shared UI rejects state',
    'src/app/shared/ui/probe.ts',
    "import '@stores/categories.store';",
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
    'app accepts routes',
    'src/app/probe.ts',
    "void import('@features/collections/collections.routes');",
    true,
  ],
  [
    'app rejects private screen',
    'src/app/probe.ts',
    "void import('@features/collections/categories/categories');",
    false,
  ],
  ['unknown alias is rejected', 'src/app/core/probe.ts', "import '@models/missing';", false],
  [
    'routes accept API service',
    'src/app/features/collections/collections.routes.ts',
    "import '@services/categories.service';",
    true,
  ],
  [
    'routes accept lazy screen',
    'src/app/features/collections/collections.routes.ts',
    "void import('./categories/categories.component');",
    true,
  ],
  ['screen accepts store', screen, "import '@stores/categories.store';", true],
  ['screen accepts shared constants', screen, "import '@constants/category.constants';", true],
  ['screen accepts shared model', screen, "import '@models/category.dto';", true],
  ['screen rejects service', screen, "import '@services/categories.service';", false],
  ['screen rejects HTTP transport', screen, "import '@core/http/api-client';", false],
  ['screen rejects raw HTTP', screen, "import '@angular/common/http';", false],
  [
    'screen rejects another feature',
    screen,
    "import '@features/control-gallery/control-gallery.routes';",
    false,
  ],
  [
    'store accepts service',
    'src/app/stores/probe.ts',
    "import '@services/categories.service';",
    true,
  ],
  ['store rejects transport', 'src/app/stores/probe.ts', "import '@core/http/api-client';", false],
  ['store rejects raw HTTP', 'src/app/stores/probe.ts', "import '@angular/common/http';", false],
  [
    'store rejects feature',
    'src/app/stores/probe.ts',
    "import '@features/collections/categories/categories';",
    false,
  ],
  [
    'service accepts transport',
    'src/app/services/probe.ts',
    "import '@core/http/api-client';",
    true,
  ],
  [
    'service rejects view',
    'src/app/services/probe.ts',
    "import '@features/collections/categories/categories';",
    false,
  ],
  ['utility rejects store', 'src/app/utils/probe.ts', "import '@stores/categories.store';", false],
  [
    'store rejects router',
    'src/app/stores/probe.ts',
    "import {Router} from '@angular/router';",
    false,
  ],
  ['utility accepts sibling', 'src/app/utils/probe.ts', "import './text.util';", true],
  ['model rejects store', 'src/app/models/probe.ts', "import '@stores/categories.store';", false],
  ['form rejects store', 'src/app/forms/probe.ts', "import '@stores/category-io.store';", false],
  ['component enum is outside the screen', screen, "export enum Status { Draft = 'draft' }", false],
  ['component model is outside the screen', screen, 'export interface Item { id: string; }', false],
  [
    'component options are outside the screen',
    screen,
    "export class Example { readonly options = [{ value: 'draft' }]; }",
    false,
  ],
  [
    'fields precede methods',
    screen,
    'export class Example { run(): void {} readonly label = "Example"; }',
    false,
  ],
  [
    'enum has its own folder',
    'src/app/enums/probe.ts',
    "export enum Status { Draft = 'draft' }",
    true,
  ],
  [
    'test can use HTTP testing',
    'src/app/services/probe.spec.ts',
    "import '@angular/common/http/testing';",
    true,
  ],
];
probes.push(
  ['utility rejects DI', 'src/app/utils/probe.ts', "import {inject} from '@angular/core';", false],
  [
    'utility rejects storage',
    'src/app/utils/probe.ts',
    "export const read = () => localStorage.getItem('q');",
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
    'src/app/models/probe.ts',
    "import '@features/collections/categories/categories';",
    false,
  ],
  [
    'screen rejects eager change detection',
    screen,
    "import {Component,ChangeDetectionStrategy} from '@angular/core'; @Component({selector:'app-test',template:'',changeDetection:ChangeDetectionStrategy.Eager}) export class Test {}",
    false,
  ],
  [
    'screen rejects UI selector',
    screen,
    "import {Component,ChangeDetectionStrategy} from '@angular/core'; @Component({selector:'ui-test',template:'',changeDetection:ChangeDetectionStrategy.OnPush}) export class Test {}",
    false,
  ],
);
for (const [name, filePath, code, allowed] of probes) {
  const results = await eslint.lintText(code, { filePath });
  const errors = results
    .flatMap((result) => result.messages)
    .filter(
      (message) =>
        message.ruleId?.startsWith('boundaries/') ||
        message.ruleId === 'no-restricted-syntax' ||
        message.ruleId === 'no-restricted-globals' ||
        message.ruleId === '@angular-eslint/prefer-on-push-component-change-detection' ||
        message.ruleId === '@angular-eslint/component-selector' ||
        message.ruleId === '@typescript-eslint/member-ordering' ||
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
for (const folder of [
  'constants',
  'enums',
  'models',
  'services',
  'stores',
  'forms',
  'guards',
  'utils',
]) {
  assert.ok(fs.existsSync(path.join(cwd, 'src/app', folder)), `Missing shared folder: ${folder}`);
  assert.ok(
    !fs.existsSync(path.join(cwd, 'src/app/features/collections', folder)),
    `Move ${folder} beside features`,
  );
}
for (const file of files(path.join(cwd, 'src/app'))) {
  if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) continue;
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
      !fs.existsSync(file.replace(/\.ts$/u, '.spec.ts')),
      `Component tests belong in src/tests/components: ${file}`,
    );
    assert.ok(
      !fs.existsSync(file.replace(/\.ts$/u, '.scss')),
      `Use the shared SCSS boundary: ${file}`,
    );
  }
}
for (const [folder, suffix] of Object.entries({
  constants: 'constants',
  enums: 'enum',
  models: '(?:dto|model)',
  services: 'service',
  stores: 'store',
  guards: 'guard',
  utils: 'util',
})) {
  for (const file of files(path.join(cwd, 'src/app', folder))) {
    if (!file.endsWith('.spec.ts'))
      assert.match(file, new RegExp(`\\.${suffix}\\.ts$`, 'u'), `Wrong role suffix: ${file}`);
  }
}
const angular = JSON.parse(fs.readFileSync(path.join(cwd, 'angular.json'), 'utf8'));
const defaults = angular.projects['boilerate-admin'].schematics['@schematics/angular:component'];
assert.equal(defaults.style, 'none');
assert.equal(defaults.skipTests, true);
assert.equal(defaults.type, 'component');
assert.equal(defaults.addTypeToClassName, false);
console.log(`Architecture: ${probes.length} import checks and screen/style rules passed.`);
