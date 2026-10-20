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
        { type: 'feature', pattern: 'src/app/features/*', capture: ['feature'] },
        { type: 'core', pattern: 'src/app/core' },
        { type: 'layout', pattern: 'src/app/layout' },
        { type: 'shared-ui', pattern: 'src/app/shared/ui' },
        { type: 'shared-forms', pattern: 'src/app/shared/forms' },
        { type: 'composition', pattern: 'src/app/*.ts', mode: 'file' },
        { type: 'bootstrap', pattern: 'src/*.ts', mode: 'file' },
      ],
      'import/resolver': {
        typescript: { project: './tsconfig.json', alwaysTryTypes: true },
      },
    },
    rules: {
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
              allow: ['core', 'layout', 'shared-ui', 'shared-forms', 'composition', 'feature'],
            },
            {
              from: 'core',
              allow: ['core'],
            },
            {
              from: 'layout',
              allow: ['layout', 'core', 'shared-ui', 'shared-forms'],
            },
            { from: 'shared-ui', allow: ['shared-ui'] },
            { from: 'shared-forms', allow: ['shared-forms'] },
            {
              from: 'feature',
              allow: ['core', 'shared-ui', 'shared-forms'],
            },
          ],
        },
      ],
      'boundaries/entry-point': [
        'error',
        {
          default: 'allow',
          rules: [
            { target: 'feature', disallow: ['**/*'] },
            { target: 'feature', allow: ['index.ts', '*.routes.ts'] },
          ],
        },
      ],
      'boundaries/external': [
        'error',
        {
          default: 'allow',
          rules: [
            {
              from: 'shared-ui',
              disallow: [['@angular/common', { path: '/http{,/**}' }]],
              message:
                'Shared UI is presentation only; HTTP belongs to core or feature data-access.',
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
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    files: ['src/**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
  },
);
