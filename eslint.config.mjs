import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import boundaries from 'eslint-plugin-boundaries';
import { fileURLToPath } from 'node:url';

const featureLayers = [
  'feature-entry',
  'feature-wiring',
  'feature-page',
  'feature-ui',
  'feature-state',
  'feature-form',
  'feature-model',
  'feature-enum',
  'feature-constant',
  'feature-data',
  'feature-mock',
  'feature-fixture',
  'feature-navigation',
  'feature-guard',
  'feature-service',
];
const inFeature = (...types) => types.map((type) => [type, { feature: '${from.feature}' }]);
const presentation = ['shared-ui', 'shared-forms'];

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
        ...[
          ['feature-test', 'src/app/features/*/{pages,components}/**/*.spec.ts', 'file'],
          ['feature-entry', 'src/app/features/*/{index,*.routes}.ts', 'file'],
          ['feature-wiring', 'src/app/features/*/*.providers.ts', 'file'],
          ['feature-page', 'src/app/features/*/pages/*', 'folder'],
          ['feature-ui', 'src/app/features/*/components/*', 'folder'],
          ['feature-state', 'src/app/features/*/state', 'folder'],
          ['feature-form', 'src/app/features/*/forms', 'folder'],
          ['feature-model', 'src/app/features/*/models', 'folder'],
          ['feature-enum', 'src/app/features/*/enums', 'folder'],
          ['feature-constant', 'src/app/features/*/constants', 'folder'],
          ['feature-mock', 'src/app/features/*/data-access/mock-*', 'file'],
          ['feature-fixture', 'src/app/features/*/data-access/*.fixtures.ts', 'file'],
          ['feature-data', 'src/app/features/*/data-access', 'folder'],
          ['feature-navigation', 'src/app/features/*/navigation', 'folder'],
          ['feature-guard', 'src/app/features/*/guards', 'folder'],
          ['feature-service', 'src/app/features/*/services', 'folder'],
        ].map(([type, pattern, mode]) => ({ type, pattern, mode, capture: ['feature'] })),
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
              allow: ['core', 'layout', ...presentation, 'composition', 'feature-entry'],
            },
            {
              from: 'core',
              allow: ['core', 'http-transport'],
            },
            { from: 'http-transport', allow: ['core', 'http-transport'] },
            {
              from: 'layout',
              allow: ['layout', 'core', 'shared-ui', 'shared-forms'],
            },
            { from: 'shared-ui', allow: ['shared-ui'] },
            { from: 'shared-forms', allow: ['shared-forms'] },
            {
              from: 'feature-entry',
              allow: ['core', ...inFeature(...featureLayers)],
            },
            { from: 'feature-wiring', allow: inFeature(...featureLayers) },
            {
              from: 'feature-page',
              allow: [
                'core',
                ...presentation,
                ...inFeature(
                  'feature-state',
                  'feature-ui',
                  'feature-model',
                  'feature-enum',
                  'feature-constant',
                  'feature-form',
                  'feature-service',
                ),
              ],
            },
            {
              from: 'feature-ui',
              allow: [
                ...presentation,
                ...inFeature(
                  'feature-ui',
                  'feature-model',
                  'feature-form',
                  'feature-enum',
                  'feature-constant',
                ),
              ],
            },
            {
              from: 'feature-state',
              allow: [
                'core',
                'shared-forms',
                ...inFeature(
                  'feature-state',
                  'feature-data',
                  'feature-model',
                  'feature-enum',
                  'feature-constant',
                  'feature-form',
                  'feature-service',
                ),
              ],
            },
            {
              from: 'feature-form',
              allow: [
                'shared-forms',
                ...inFeature('feature-model', 'feature-enum', 'feature-constant'),
              ],
            },
            {
              from: 'feature-data',
              allow: [
                'core',
                'http-transport',
                ...inFeature('feature-model', 'feature-enum', 'feature-constant'),
              ],
            },
            {
              from: 'feature-mock',
              allow: inFeature(
                'feature-mock',
                'feature-data',
                'feature-model',
                'feature-fixture',
                'feature-enum',
                'feature-constant',
              ),
            },
            {
              from: 'feature-fixture',
              allow: inFeature('feature-model', 'feature-enum', 'feature-constant'),
            },
            { from: 'feature-model', allow: inFeature('feature-enum', 'feature-constant') },
            { from: 'feature-enum', allow: [] },
            { from: 'feature-constant', allow: inFeature('feature-enum', 'feature-model') },
            {
              from: 'feature-navigation',
              allow: [
                'core',
                ...inFeature('feature-data', 'feature-model', 'feature-enum', 'feature-constant'),
              ],
            },
            { from: 'feature-guard', allow: inFeature('feature-page') },
            {
              from: 'feature-service',
              allow: inFeature('feature-model', 'feature-enum', 'feature-constant'),
            },
            {
              from: 'feature-test',
              allow: ['core', ...presentation, ...inFeature(...featureLayers)],
            },
          ],
        },
      ],
      'boundaries/external': [
        'error',
        {
          default: 'allow',
          rules: [
            {
              from: [
                'shared-ui',
                'feature-page',
                'feature-ui',
                'feature-state',
                'feature-form',
                'feature-model',
                'feature-navigation',
              ],
              disallow: [['@angular/common', { path: '/http{,/**}' }]],
              message:
                'HTTP belongs to core or feature data-access; views and state use the feature service contract.',
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
    files: [
      'src/app/features/*/{pages,components}/**/*.ts',
      'src/app/shared/ui/*/*.ts',
      'src/app/layout/**/*.ts',
    ],
    ignores: ['**/*.spec.ts', '**/*.model.ts'],
    rules: {
      '@typescript-eslint/member-ordering': [
        'error',
        { default: ['field', 'constructor', 'method'] },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: 'TSEnumDeclaration', message: 'Declare feature enums in enums/*.enum.ts.' },
        { selector: 'TSInterfaceDeclaration', message: 'Declare feature interfaces in models/.' },
        {
          selector: 'TSTypeAliasDeclaration',
          message: 'Declare feature types in models/ or enums/.',
        },
        {
          selector: 'PropertyDefinition > ArrayExpression > :matches(ObjectExpression, Literal)',
          message:
            'Move configurable option/column arrays to the owning constants file; keep component dependencies explicit.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
  },
);
