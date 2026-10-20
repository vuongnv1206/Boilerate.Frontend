import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const eslint = new ESLint({ cwd });
const probes = [
  [
    'core rejects relative feature import',
    'src/app/core/architecture-probe.ts',
    "import '../features/content';",
    false,
  ],
  [
    'core rejects alias feature import',
    'src/app/core/architecture-probe.ts',
    "import '@features/content';",
    false,
  ],
  [
    'core rejects layout import',
    'src/app/core/architecture-probe.ts',
    "import '@layout/admin-shell/admin-shell';",
    false,
  ],
  [
    'layout rejects feature public entry',
    'src/app/layout/architecture-probe.ts',
    "import '@features/content';",
    false,
  ],
  [
    'shared UI rejects core state',
    'src/app/shared/ui/architecture-probe.ts',
    "import '@core/theme/theme-controller';",
    false,
  ],
  [
    'shared UI rejects HTTP',
    'src/app/shared/ui/architecture-probe.ts',
    "import '@angular/common/http';",
    false,
  ],
  [
    'feature rejects relative cross-feature import',
    'src/app/features/content/pages/content/architecture-probe.ts',
    "import '@features/control-gallery/pages/control-gallery/control-gallery';",
    false,
  ],
  [
    'feature rejects alias cross-feature public entry',
    'src/app/features/control-gallery/pages/control-gallery/architecture-probe.ts',
    "import '@features/content';",
    false,
  ],
  [
    'composition rejects feature private store',
    'src/app/architecture-probe.ts',
    "import '@features/content/state/content.store';",
    false,
  ],
  [
    'composition rejects dynamic private import',
    'src/app/architecture-probe.ts',
    "void import('@features/content/pages/content-io/content-io');",
    false,
  ],
  [
    'composition rejects private barrel export',
    'src/app/architecture-probe.ts',
    "export * from '@features/content/models/content-item';",
    false,
  ],
  [
    'unresolved alias cannot bypass classification',
    'src/app/core/architecture-probe.ts',
    "import '@features/missing/unknown';",
    false,
  ],
  [
    'composition accepts feature public entry',
    'src/app/architecture-probe.ts',
    "import '@features/content';",
    true,
  ],
  [
    'composition accepts lazy feature routes',
    'src/app/architecture-probe.ts',
    "void import('@features/control-gallery/control-gallery.routes');",
    true,
  ],
  [
    'page accepts its state',
    'src/app/features/content/pages/content/architecture-probe.ts',
    "import '../../state/content.store';",
    true,
  ],
  [
    'layout accepts navigation contract',
    'src/app/layout/architecture-probe.ts',
    "import '@core/navigation/workspace-navigation';",
    true,
  ],
  [
    'shared UI accepts presentation sibling',
    'src/app/shared/ui/architecture-probe.ts',
    "import './icon/icon';",
    true,
  ],
  [
    'page rejects relative mock import',
    'src/app/features/content/pages/content/architecture-probe.ts',
    "import '../../data-access/mock-content.service';",
    false,
  ],
  [
    'page rejects direct data service',
    'src/app/features/content/pages/content/architecture-probe.ts',
    "import '@features/content/data-access/content.service';",
    false,
  ],
  [
    'page rejects HTTP',
    'src/app/features/content/pages/content/architecture-probe.ts',
    "import '@angular/common/http';",
    false,
  ],
  [
    'presentation rejects state',
    'src/app/features/content/components/content-table/architecture-probe.ts',
    "import '@features/content/state/content.store';",
    false,
  ],
  [
    'presentation rejects service',
    'src/app/features/content/components/content-form/architecture-probe.ts',
    "import '../../data-access/content.service';",
    false,
  ],
  [
    'presentation rejects HTTP',
    'src/app/features/content/components/content-form/architecture-probe.ts',
    "import '@angular/common/http';",
    false,
  ],
  [
    'state rejects concrete mock',
    'src/app/features/content/state/architecture-probe.ts',
    "import '../data-access/mock-content.service';",
    false,
  ],
  [
    'state rejects fixture',
    'src/app/features/content/state/architecture-probe.ts',
    "import '../data-access/content.fixtures';",
    false,
  ],
  [
    'state rejects HTTP',
    'src/app/features/content/state/architecture-probe.ts',
    "import '@angular/common/http';",
    false,
  ],
  [
    'model rejects state',
    'src/app/features/content/models/architecture-probe.ts',
    "import '../state/content.store';",
    false,
  ],
  [
    'forms reject state',
    'src/app/features/content/forms/architecture-probe.ts',
    "import '../state/content-io.store';",
    false,
  ],
  [
    'data rejects view',
    'src/app/features/content/data-access/architecture-probe.ts',
    "import '../pages/content/content';",
    false,
  ],
  [
    'navigation rejects fixture',
    'src/app/features/content/navigation/architecture-probe.ts',
    "import '../data-access/content.fixtures';",
    false,
  ],
  [
    'composition rejects concrete feature provider',
    'src/app/architecture-probe.ts',
    "import '@features/content/content.providers';",
    false,
  ],
  [
    'state accepts data contract',
    'src/app/features/content/state/architecture-probe.ts',
    "import '../data-access/content.service';",
    true,
  ],
  [
    'presentation accepts model',
    'src/app/features/content/components/content-form/architecture-probe.ts',
    "import '@features/content/models/content-item';",
    true,
  ],
  [
    'feature wiring accepts mock implementation',
    'src/app/features/content/content.providers.ts',
    "import './data-access/mock-content.service';",
    true,
  ],
  [
    'data accepts HTTP base',
    'src/app/features/content/data-access/architecture-probe.ts',
    "import '@core/http/api-client';",
    true,
  ],
  [
    'page rejects HTTP transport through core alias',
    'src/app/features/content/pages/content/architecture-probe.ts',
    "import '@core/http/api-client';",
    false,
  ],
  [
    'state rejects HTTP transport through relative import',
    'src/app/features/content/state/architecture-probe.ts',
    "import '../../../core/http/api-client';",
    false,
  ],
  [
    'component rejects inline enum',
    'src/app/features/content/components/content-toolbar/architecture-probe.ts',
    "export enum LocalStatus { Draft = 'draft' }",
    false,
  ],
  [
    'page rejects inline interface',
    'src/app/features/content/pages/content/architecture-probe.ts',
    'export interface LocalItem { id: string; }',
    false,
  ],
  [
    'component rejects inline type alias',
    'src/app/features/content/components/content-form/architecture-probe.ts',
    "export type LocalMode = 'edit' | 'create';",
    false,
  ],
  [
    'component rejects inline option array',
    'src/app/features/content/components/content-toolbar/architecture-probe.ts',
    "export class Example { readonly options = [{ value: 'draft' }]; }",
    false,
  ],
  [
    'component rejects fields inserted after handlers',
    'src/app/features/content/components/content-toolbar/architecture-probe.ts',
    'export class Example { run(): void {} readonly label = "Example"; }',
    false,
  ],
  [
    'feature enum is declared in its own layer',
    'src/app/features/content/enums/architecture-probe.ts',
    "export enum ExampleStatus { Draft = 'draft' }",
    true,
  ],
  [
    'component accepts owned constants',
    'src/app/features/content/components/content-toolbar/architecture-probe.ts',
    "import '../../constants/content-toolbar.constants';",
    true,
  ],
  [
    'component rejects a foreign feature enum',
    'src/app/features/content/components/content-toolbar/architecture-probe.ts',
    "import '@features/control-gallery/enums/gallery-tab.enum';",
    false,
  ],
  [
    'page rejects foreign feature configuration',
    'src/app/features/content/pages/content/architecture-probe.ts',
    "import '@features/control-gallery/constants/gallery.constants';",
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
        message.ruleId === 'no-restricted-syntax' ||
        message.ruleId === '@typescript-eslint/member-ordering' ||
        message.fatal,
    );
  assert.equal(errors.length === 0, allowed, `${name}: ${JSON.stringify(errors)}`);
}

console.log(
  `Architecture boundaries: ${probes.length} positive and negative import probes passed.`,
);
