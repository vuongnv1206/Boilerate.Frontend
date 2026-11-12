import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { startLivePreview } from './live-acceptance-preview.mjs';

// CLI: node scripts/live-acceptance.mjs [--skip-build] [-- <Playwright test arguments>]
// --skip-build reuses frontend output; the isolated backend runner always builds Release.
// BOILERATE_TEST_MSSQL chooses the SQL Server instance, never an existing target DB.
// Optional BOILERATE_BACKEND_ROOT locates the sibling backend checkout.
const frontend = resolve(import.meta.dirname, '..');
const backend = resolve(process.env.BOILERATE_BACKEND_ROOT ?? resolve(frontend, '../Boilerate'));
const arguments_ = process.argv.slice(2).filter((argument) => argument !== '--');
const skipBuild = arguments_.includes('--skip-build');
const playwrightArguments = arguments_.filter((argument) => argument !== '--skip-build');
const run = resolve(frontend, 'artifacts/live-acceptance', randomUUID());
const startedAt = new Date().toISOString();
const readyFile = resolve(run, 'ready.json');
const stopFile = resolve(run, 'stop');
const project = resolve(backend, 'tests/Boilerate.LiveAcceptance/Boilerate.LiveAcceptance.csproj');
const hostDll = resolve(
  backend,
  'tests/Boilerate.LiveAcceptance/bin/Release/net10.0/Boilerate.Tests.dll',
);
await mkdir(run, { recursive: true });
let host;
let preview;
let tests;
let activeCommand;
let interrupted = false;
let result = 1;

function launch(command, arguments_, { cwd = frontend, env = process.env, log } = {}) {
  const child = spawn(command, arguments_, {
    cwd,
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = log ? createWriteStream(log) : process.stdout;
  child.stdout.pipe(output, { end: false });
  child.stderr.pipe(output, { end: false });
  child.done = new Promise((accept, reject) => {
    child.once('error', (error) => {
      child.launchError = error;
      reject(error);
    });
    child.once('exit', (code, signal) => {
      if (log) output.end();
      accept(code ?? (signal ? 1 : 0));
    });
  });
  // Readiness polling observes failure through this field without swallowing process errors.
  child.done.catch(() => {});
  return child;
}
async function command(command_, arguments_, options) {
  if (interrupted) throw new Error('Live acceptance interrupted.');
  const child = launch(command_, arguments_, options);
  activeCommand = child;
  try {
    const code = await child.done;
    if (interrupted) throw new Error('Live acceptance interrupted.');
    if (code !== 0) throw new Error(`${command_} exited ${code}; see ${options?.log ?? 'output'}.`);
  } finally {
    if (activeCommand === child) activeCommand = undefined;
  }
}
async function frontendBuildEvidence() {
  const directory = resolve(frontend, 'dist/boilerate-frontend/browser');
  const entries = await readdir(directory, { withFileTypes: true });
  const names = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        (entry.name === 'index.html' ||
          entry.name === 'runtime-config.js' ||
          /^(main-|styles-).+\.(js|css)$/u.test(entry.name)),
    )
    .map((entry) => entry.name)
    .sort();
  return Promise.all(
    names.map(async (file) => ({
      file,
      sha256: createHash('sha256')
        .update(await readFile(resolve(directory, file)))
        .digest('hex'),
    })),
  );
}
const stop = () => {
  interrupted = true;
  result = 130;
  if (activeCommand?.exitCode === null) activeCommand.kill('SIGTERM');
  if (tests?.exitCode === null) tests.kill('SIGTERM');
  // The backend owns database cleanup and exits normally after observing this file.
  void writeFile(stopFile, 'stop\n').catch(() => {});
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

try {
  console.log(`Live acceptance artifacts: ${run}`);
  if (!skipBuild) {
    await command(process.execPath, [resolve(frontend, 'scripts/runtime-config.mjs')], {
      env: { ...process.env, API_BASE_URL: '/api' },
    });
    await command(
      process.execPath,
      [resolve(frontend, 'node_modules/@angular/cli/bin/ng.js'), 'build'],
      {
        log: resolve(run, 'frontend-build.log'),
      },
    );
  }
  await command(
    'dotnet',
    ['build', project, '--configuration', 'Release', '--nologo', '--verbosity', 'quiet'],
    {
      cwd: backend,
      log: resolve(run, 'backend-build.log'),
    },
  );
  host = launch('dotnet', [hostDll, '--ready-file', readyFile, '--stop-file', stopFile], {
    cwd: backend,
    log: resolve(run, 'backend.log'),
  });
  let manifest;
  const deadline = Date.now() + 180_000;
  while (!manifest && Date.now() < deadline) {
    if (host.launchError) throw host.launchError;
    if (host.exitCode !== null)
      throw new Error(`Isolated backend exited ${host.exitCode}; see ${run}/backend.log.`);
    try {
      manifest = JSON.parse(await readFile(readyFile, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await delay(250);
    }
  }
  if (interrupted) throw new Error('Live acceptance interrupted.');
  if (!manifest) throw new Error(`Isolated backend readiness timed out; see ${run}/backend.log.`);
  if (!/^boilerate_test_[a-f0-9]{32}$/u.test(manifest.database)) {
    throw new Error('Backend did not confirm a fresh fixture-owned database.');
  }
  preview = await startLivePreview({ backendUrl: manifest.backendUrl });
  console.log(`Live browser target: ${preview.url}; database: ${manifest.database}`);
  await writeFile(
    resolve(run, 'run.json'),
    JSON.stringify(
      {
        startedAt,
        database: manifest.database,
        migrations: manifest.migrations,
        backendUrl: manifest.backendUrl,
        baseURL: preview.url,
        frontendBuild: await frontendBuildEvidence(),
      },
      null,
      2,
    ),
  );
  tests = launch(
    process.execPath,
    [
      resolve(frontend, 'node_modules/@playwright/test/cli.js'),
      'test',
      '--config=playwright.live.config.ts',
      ...playwrightArguments,
    ],
    {
      env: {
        ...process.env,
        LIVE_ACCEPTANCE_MANIFEST: readyFile,
        LIVE_BASE_URL: preview.url,
        LIVE_ARTIFACTS: run,
      },
    },
  );
  const testExitCode = await tests.done;
  result = interrupted ? 130 : testExitCode;
} catch (error) {
  console.error(error.message);
} finally {
  await preview?.close();
  let cleanupComplete = !host;
  if (host && host.exitCode === null) {
    await writeFile(stopFile, 'stop\n');
    const graceful = await Promise.race([host.done, delay(30_000, null, { ref: false })]);
    if (graceful === null) {
      console.error(
        `Backend cleanup timed out. Inspect ${run}/backend.log and the database in run.json.`,
      );
      host.kill();
      result = 1;
    } else if (graceful !== 0) {
      console.error(`Backend cleanup exited ${graceful}; inspect ${run}/backend.log.`);
      result = 1;
    } else {
      cleanupComplete = true;
    }
  } else if (host) {
    const code = await host.done;
    if (code !== 0) result = 1;
    else cleanupComplete = true;
  }
  await rm(readyFile, { force: true });
  await rm(`${readyFile}.tmp`, { force: true });
  if (cleanupComplete) {
    const ownedRuntime = resolve(run, 'runtime');
    try {
      const actualRun = await realpath(run);
      const actualRuntime = await realpath(ownedRuntime);
      if (actualRuntime !== resolve(actualRun, 'runtime')) {
        throw new Error('Runtime cleanup target escaped the owned run directory.');
      }
      await rm(ownedRuntime, { recursive: true, force: true });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
}
process.exitCode = result;
