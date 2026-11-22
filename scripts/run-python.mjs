// Runs a Python script with the project's own virtual environment if there is one,
// so `npm run dev` and `npm run build` work the same on every computer and in CI.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function findPython() {
  const venv = [join(root, '.venv/bin/python'), join(root, '.venv/Scripts/python.exe')];
  return venv.find((p) => existsSync(p)) ?? (process.platform === 'win32' ? 'python' : 'python3');
}

/** Runs a script and returns its exit code and everything it printed. */
export function runPython(args) {
  const result = spawnSync(findPython(), args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  let output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.error) output += `Couldn't start Python: ${result.error.message}\n`;
  if (/ModuleNotFoundError/.test(output)) {
    output +=
      '\nThe Python packages are missing. Set them up once with:\n' +
      '  python3 -m venv .venv\n  .venv/bin/pip install -r requirements.txt\n';
  }
  return { ok: result.status === 0, output };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, output } = runPython(process.argv.slice(2));
  process.stdout.write(output);
  process.exit(ok ? 0 : 1);
}
