import { spawn } from 'node:child_process';
import { access, readFile, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { delimiter, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { validateHarnessConfig } from './config.mjs';

const PROFILES = new Set(['preCommit', 'ci']);
const OUTPUT_LIMIT = 64 * 1024;

function inside(root, target) {
  const path = relative(root, target);
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
}

function appendLimited(current, chunk) {
  if (current.length >= OUTPUT_LIMIT) return current;
  return (current + chunk.toString('utf8')).slice(0, OUTPUT_LIMIT);
}

async function resolveInvocation(command, args) {
  if (process.platform !== 'win32' || !['npm', 'npx'].includes(command.toLowerCase())) return { command, args: [...args] };
  const cliName = command.toLowerCase() === 'npm' ? 'npm-cli.js' : 'npx-cli.js';
  const candidates = [
    process.env.npm_execpath,
    join(dirname(process.execPath), 'node_modules', 'npm', 'bin', cliName),
    ...String(process.env.PATH ?? '').split(delimiter).filter(Boolean).map((path) => join(path, 'node_modules', 'npm', 'bin', cliName))
  ].filter((path) => typeof path === 'string' && path.toLowerCase().endsWith(cliName));
  for (const cli of candidates) {
    try { await access(cli, constants.F_OK); return { command: process.execPath, args: [cli, ...args], declaredCommand: command }; }
    catch { /* try the next installation root */ }
  }
  return { command, args: [...args] };
}

async function runCheck(root, check) {
  const started = Date.now();
  const cwd = await realpath(join(root, check.cwd));
  if (!inside(root, cwd)) throw new Error(`gate cwd escapes project root: ${check.id}`);
  const invocation = await resolveInvocation(check.command, check.args);

  return new Promise((resolveResult) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const child = spawn(invocation.command, invocation.args, { cwd, shell: false, windowsHide: true });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, check.timeoutSeconds * 1000);

    child.stdout?.on('data', (chunk) => { stdout = appendLimited(stdout, chunk); });
    child.stderr?.on('data', (chunk) => { stderr = appendLimited(stderr, chunk); });
    const finish = (status, exitCode, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveResult({
        id: check.id,
        command: invocation.command,
        args: invocation.args,
        ...(invocation.declaredCommand ? { declaredCommand: invocation.declaredCommand } : {}),
        cwd: check.cwd,
        required: check.required,
        status,
        exitCode,
        durationMs: Date.now() - started,
        stdout,
        stderr: error ? appendLimited(stderr, error.message) : stderr
      });
    };
    child.on('error', (error) => finish('error', null, error));
    child.on('close', (code) => finish(timedOut ? 'timed_out' : code === 0 ? 'passed' : 'failed', code));
  });
}

export async function runGateProfile(projectRoot, profile) {
  if (!PROFILES.has(profile)) throw new Error(`unknown gate profile: ${profile}`);
  const root = await realpath(resolve(projectRoot));
  const config = JSON.parse(await readFile(join(root, '.codebuddy', 'harness.json'), 'utf8'));
  const errors = validateHarnessConfig(config);
  if (errors.length) throw new Error(`invalid harness config: ${errors.join('; ')}`);

  const checks = [];
  for (const check of config.gates[profile]) {
    const result = await runCheck(root, check);
    checks.push(result);
    if (check.required && result.status !== 'passed') break;
  }
  const configured = checks.length > 0;
  const ok = configured && checks.every((check) => !check.required || check.status === 'passed');
  return {
    schemaVersion: '1.0',
    profile,
    ok,
    status: !configured ? 'unconfigured' : ok ? 'passed' : 'failed',
    ...(!configured ? { reason: `no gates configured for ${profile}` } : {}),
    checks,
    finishedAt: new Date().toISOString()
  };
}
