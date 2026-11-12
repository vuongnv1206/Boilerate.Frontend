import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import boundaries from 'eslint-plugin-boundaries';
import { fileURLToPath } from 'node:url';

export default tseslint.config(
  { ignores: ['dist/**', '.angular/**', 'node_modules/**', 'artifacts/**'] },
  {
    files: ['src/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    plugins: { boundaries },
    settings: {
      'boundaries/root-path': fileURLToPath(new URL('.', import.meta.url)),
      'boundaries/flag-as-external': { unresolvableAlias: false },
      'boundaries/dependency-nodes': ['import', 'dynamic-import', 'export', 'require'],
      'boundaries/elements': [
        {
          type: 'module-entry',
          pattern: 'src/app/modules/*/*.routes.ts',
          capture: ['module'],
          mode: 'file',
        },
        {
          type: 'api-service',
          pattern: 'src/app/api/*/services/**/*.ts',
          capture: ['module'],
          mode: 'file',
        },
        {
          type: 'api-model',
          pattern: 'src/app/api/*/models/**/*.ts',
          capture: ['module'],
          mode: 'file',
        },
        {
          type: 'module-view',
          pattern: 'src/app/modules/*/**/*.ts',
          capture: ['module'],
          mode: 'file',
        },
        {
          type: 'http-transport',
          pattern: 'src/app/core/http/api.service.ts',
          mode: 'file',
        },
        { type: 'core', pattern: 'src/app/core/**/*.ts', mode: 'file' },
        { type: 'layout', pattern: 'src/app/layout/**/*.ts', mode: 'file' },
        { type: 'shared-ui', pattern: 'src/app/shared/ui/**/*.ts', mode: 'file' },
        { type: 'shared-forms', pattern: 'src/app/shared/forms/**/*.ts', mode: 'file' },
        { type: 'shared-utils', pattern: 'src/app/shared/utils/**/*.ts', mode: 'file' },
        { type: 'shared-guards', pattern: 'src/app/shared/guards/**/*.ts', mode: 'file' },
        { type: 'shared-bundle', pattern: 'src/app/shared/*.ts', mode: 'file' },
        { type: 'composition', pattern: 'src/app/*.ts', mode: 'file' },
        { type: 'bootstrap', pattern: 'src/*.ts', mode: 'file' },
      ],
      'import/resolver': { typescript: { project: './tsconfig.json', alwaysTryTypes: true } },
    },
    rules: {
      '@angular-eslint/prefer-on-push-component-change-detection': 'off',
      '@angular-eslint/prefer-inject': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'boundaries/no-unknown-files': 'error',
      'boundaries/no-unknown': 'error',
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'bootstrap', allow: ['composition', 'core'] },
            {
              from: 'composition',
              allow: [
                'composition',
                'core',
                'layout',
                'shared-guards',
                'shared-bundle',
                'module-entry',
                'api-service',
              ],
            },
            { from: 'core', allow: ['core', 'http-transport'] },
            { from: 'http-transport', allow: ['core', 'http-transport'] },
            {
              from: 'layout',
              allow: [
                'layout',
                'core',
                'shared-ui',
                'shared-forms',
                'shared-utils',
                'shared-bundle',
                'api-service',
                'api-model',
              ],
            },
            { from: 'shared-ui', allow: ['shared-ui', 'shared-bundle'] },
            { from: 'shared-forms', allow: ['shared-forms', 'core'] },
            { from: 'shared-utils', allow: ['shared-utils'] },
            { from: 'shared-guards', allow: ['shared-guards', 'core'] },
            {
              from: 'shared-bundle',
              allow: [
                'shared-bundle',
                'shared-ui',
                'shared-forms',
                'shared-utils',
                'shared-guards',
                'core',
              ],
            },
            {
              from: 'api-service',
              allow: [
                'api-service',
                'api-model',
                'core',
                'http-transport',
                'shared-utils',
                'shared-bundle',
              ],
            },
            {
              from: 'api-model',
              allow: ['api-model', 'core', 'shared-forms', 'shared-utils', 'shared-bundle'],
            },
            {
              from: 'module-entry',
              allow: [
                'module-view',
                'module-entry',
                'api-service',
                'api-model',
                'core',
                'layout',
                'shared-ui',
                'shared-forms',
                'shared-utils',
                'shared-guards',
                'shared-bundle',
              ],
            },
            {
              from: 'module-view',
              allow: [
                'module-view',
                'module-entry',
                'api-service',
                'api-model',
                'core',
                'shared-ui',
                'shared-forms',
                'shared-utils',
                'shared-guards',
                'shared-bundle',
              ],
            },
          ],
        },
      ],
      'boundaries/external': [
        'error',
        {
          default: 'allow',
          rules: [
            { from: ['shared-utils'], disallow: ['@angular/**', 'rxjs'] },
            {
              from: ['shared-utils', 'api-service', 'api-model', 'shared-ui'],
              disallow: ['@angular/router'],
            },
            {
              from: ['module-view', 'api-model', 'shared-ui', 'shared-utils'],
              disallow: [['@angular/common', { path: '/http{,/**}' }]],
              message: 'Call the API service. HTTP belongs to ApiService.',
            },
          ],
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: ['app', 'ui'], style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: ['app', 'ui'], style: 'camelCase' },
      ],
    },
  },
  {
    files: ['src/app/modules/**/*.ts', 'src/app/layout/**/*.ts'],
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
    },
  },
  {
    files: ['src/app/shared/ui/**/*.ts'],
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'ui', style: 'kebab-case' },
      ],
    },
  },
  {
    files: ['src/**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
  },
);
