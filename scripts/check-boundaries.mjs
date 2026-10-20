import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const eslint = new ESLint({ cwd });
const probes = [
  [
    'core rejects relative feature import',
    'src/app/core/architecture-probe.ts',
    "import '../features/content-workspace';",
    false,
  ],
  [
    'core rejects alias feature import',
    'src/app/core/architecture-probe.ts',
    "import '@features/content-workspace';",
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
    "import '@features/content-workspace';",
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
    'src/app/features/content-workspace/architecture-probe.ts',
    "import '../control-gallery/control-gallery';",
    false,
  ],
  [
    'feature rejects alias cross-feature public entry',
    'src/app/features/control-gallery/architecture-probe.ts',
    "import '@features/content-workspace';",
    false,
  ],
  [
    'composition rejects feature private store',
    'src/app/architecture-probe.ts',
    "import '@features/content-workspace/demo-content-store';",
    false,
  ],
  [
    'composition rejects dynamic private import',
    'src/app/architecture-probe.ts',
    "void import('@features/content-workspace/item-editor/item-editor');",
    false,
  ],
  [
    'composition rejects private barrel export',
    'src/app/architecture-probe.ts',
    "export * from '@features/content-workspace/content-model';",
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
    "import '@features/content-workspace';",
    true,
  ],
  [
    'composition accepts lazy feature routes',
    'src/app/architecture-probe.ts',
    "void import('@features/control-gallery/control-gallery.routes');",
    true,
  ],
  [
    'feature accepts its own internals',
    'src/app/features/content-workspace/architecture-probe.ts',
    "import './demo-content-store';",
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
];

for (const [name, filePath, code, allowed] of probes) {
  const results = await eslint.lintText(code, { filePath });
  const errors = results
    .flatMap((result) => result.messages)
    .filter((message) => message.ruleId?.startsWith('boundaries/') || message.fatal);
  assert.equal(errors.length === 0, allowed, `${name}: ${JSON.stringify(errors)}`);
}

console.log(
  `Architecture boundaries: ${probes.length} positive and negative import probes passed.`,
);
