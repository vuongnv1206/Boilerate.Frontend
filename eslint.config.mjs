import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import boundaries from 'eslint-plugin-boundaries';
import { fileURLToPath } from 'node:url';

const dataTypes = ['constants', 'enums', 'models'];
const commonTypes = [...dataTypes, 'forms', 'services', 'stores', 'guards', 'utils'];
const sameFeature = ['feature', { feature: '${from.feature}' }];

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
        { type: 'test', pattern: 'src/tests/**/*.ts', mode: 'file' },
        {
          type: 'test',
          pattern: 'src/app/{features,stores,services,forms,guards,utils}/**/*.spec.ts',
          mode: 'file',
        },
        {
          type: 'feature-entry',
          pattern: 'src/app/features/*/{index,*.routes}.ts',
          capture: ['feature'],
          mode: 'file',
        },
        { type: 'feature', pattern: 'src/app/features/*', capture: ['feature'] },
        ...commonTypes.map((type) => ({ type, pattern: `src/app/${type}` })),
        {
          type: 'http-transport',
          pattern: 'src/app/core/http/api-client{,.spec}.ts',
          mode: 'file',
        },
        { type: 'core', pattern: 'src/app/core' },
        { type: 'layout', pattern: 'src/app/layout' },
        { type: 'shared-ui', pattern: 'src/app/shared/ui' },
        { type: 'shared-forms', pattern: 'src/app/shared/forms' },
        { type: 'composition', pattern: 'src/app/*.ts', mode: 'file' },
        { type: 'bootstrap', pattern: 'src/*.ts', mode: 'file' },
      ],
      'import/resolver': { typescript: { project: './tsconfig.json', alwaysTryTypes: true } },
    },
    rules: {
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
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
              allow: ['composition', 'core', 'layout', ...dataTypes, 'guards', 'feature-entry'],
            },
            { from: 'core', allow: ['core', 'http-transport', ...dataTypes] },
            { from: 'http-transport', allow: ['core', 'http-transport'] },
            {
              from: 'layout',
              allow: ['layout', 'core', 'shared-ui', 'shared-forms', ...dataTypes],
            },
            { from: 'shared-ui', allow: ['shared-ui'] },
            { from: 'shared-forms', allow: ['shared-forms'] },
            { from: 'feature-entry', allow: [sameFeature, 'core', ...commonTypes] },
            {
              from: 'feature',
              allow: [
                sameFeature,
                'core',
                'shared-ui',
                'shared-forms',
                ...dataTypes,
                'forms',
                'stores',
                'utils',
              ],
            },
            {
              from: 'stores',
              allow: ['core', 'shared-forms', 'stores', 'services', 'forms', 'utils', ...dataTypes],
            },
            { from: 'services', allow: ['core', 'http-transport', 'services', ...dataTypes] },
            { from: 'forms', allow: ['forms', 'utils', 'shared-forms', ...dataTypes] },
            { from: 'models', allow: ['models', 'enums'] },
            { from: 'constants', allow: dataTypes },
            { from: 'enums', allow: ['enums'] },
            { from: 'utils', allow: ['utils', ...dataTypes] },
            { from: 'guards', allow: ['core', 'guards', ...dataTypes] },
            {
              from: 'test',
              allow: [
                'core',
                'http-transport',
                'shared-ui',
                'shared-forms',
                'feature',
                'composition',
                'layout',
                ...commonTypes,
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
            { from: 'utils', disallow: ['@angular/**', 'rxjs'] },
            {
              from: ['stores', 'utils', 'services', 'models', 'forms', 'shared-ui'],
              disallow: ['@angular/router'],
            },
            {
              from: ['feature', 'stores', 'forms', 'models', 'shared-ui', 'utils'],
              disallow: [['@angular/common', { path: '/http{,/**}' }]],
              message: 'Call the store/service. HTTP belongs to ApiClient and API services.',
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
    files: ['src/app/features/**/*.ts', 'src/app/shared/ui/*/*.ts', 'src/app/layout/**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.model.ts'],
    rules: {
      '@typescript-eslint/member-ordering': [
        'error',
        { default: ['field', 'constructor', 'method'] },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: 'TSEnumDeclaration', message: 'Put enums in src/app/enums.' },
        { selector: 'TSInterfaceDeclaration', message: 'Put interfaces in src/app/models.' },
        { selector: 'TSTypeAliasDeclaration', message: 'Put types in src/app/models.' },
        {
          selector: 'PropertyDefinition > ArrayExpression > :matches(ObjectExpression, Literal)',
          message: 'Put shared options in src/app/constants.',
        },
      ],
    },
  },
  {
    files: ['src/app/utils/**/*.ts', 'src/app/models/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'sessionStorage',
        'navigator',
        'fetch',
      ],
    },
  },
  {
    files: ['src/app/features/**/*.ts', 'src/app/layout/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
    },
  },
  {
    files: ['src/app/shared/ui/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'ui', style: 'kebab-case' },
      ],
    },
  },
  {
    files: ['**/*.spec.ts'],
    rules: { '@angular-eslint/prefer-on-push-component-change-detection': 'off' },
  },
  {
    files: ['src/**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
  },
);
