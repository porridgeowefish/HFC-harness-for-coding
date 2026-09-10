import { basename, resolve } from 'node:path';
import { runGateProfile } from '../runtime/gates.mjs';
import { detectHarnessScope } from '../runtime/project-scope.mjs';

const input = await new Promise((resolveInput) => {
  let body = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { body += chunk; });
  process.stdin.on('end', () => {
    try { resolveInput(JSON.parse(body || '{}')); }
    catch { resolveInput({}); }
  });
});

const toolName = String(input.tool_name ?? '');
const toolInput = input.tool_input && typeof input.tool_input === 'object' ? input.tool_input : {};
const root = resolve(process.env.CODEBUDDY_PROJECT_DIR ?? input.cwd ?? process.cwd());
const target = String(toolInput.file_path ?? toolInput.path ?? '');
const normalizedTarget = target.replaceAll('\\', '/');
const proposedText = [toolInput.content, toolInput.new_string, toolInput.newText, toolInput.text]
  .filter((value) => typeof value === 'string')
  .join('\n');

function decision(allow, reason, rule) {
  const value = {
    continue: allow,
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: allow ? 'allow' : 'deny' }
  };
  if (!allow) {
    value.reason = reason;
    value.hookSpecificOutput.permissionDecisionReason = reason;
    value.systemMessage = `${rule}: ${reason}`;
  }
  return value;
}

function ignoresSharedContract(text) {
  const positive = String(text).split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && !line.startsWith('!'));
  return positive.some((line) => {
    const pattern = line.replace(/^\//, '').replace(/\/+$/, '');
    if (pattern === '.codebuddy/workflows' || pattern.startsWith('.codebuddy/workflows/')) return false;
    return pattern === 'CODEBUDDY.md' || pattern === 'docs' || pattern.startsWith('docs/') ||
      pattern === '.codebuddy' || pattern === '.codebuddy/*' || pattern === '.codebuddy/**' ||
      ['.codebuddy/settings.json', '.codebuddy/harness.json', '.codebuddy/onboarding-checklist.json', '.codebuddy/rules', '.codebuddy/agents']
        .some((path) => pattern === path || pattern.startsWith(`${path}/`));
  });
}

function mutatesWorkflowState(command) {
  const value = String(command ?? '');
  const runtimePath = /(?:\.codebuddy[\\/]workflows[\\/][^\s"`<>|;&]+)/i.test(value);
  // A shell variable can resolve to the workflow state path without exposing
  // that path in the command text (`cp /tmp/x "$STATE"`, `${STATE}`, or
  // `%STATE%`).  We cannot safely resolve shell expansion from this hook, so a
  // variable-bearing command is treated as state-sensitive and only the
  // read-only allowlist below may continue.
  const variableReference = /(?:\$\{[^}\r\n]+\}|\$(?:env:)?[A-Za-z_][A-Za-z0-9_]*|\$[0-9]+|%[A-Za-z_][A-Za-z0-9_]*%|\$ENV\{[^}\r\n]+\}|(?:process\.env|os\.environ|Environment\.GetEnvironmentVariable)\s*[[.(])/i.test(value);
  const variableRedirect = /(?:>>?|\|\s*Set-Content\b)\s*["']?(?:\$|%)[^\s"']+/i.test(value);
  const variableMutation = /\b(?:Set-Content|Add-Content|Clear-Content|Remove-Item|Move-Item|Copy-Item|Rename-Item|Out-File|New-Item)\b[^;&|<>]*(?:\$|%)[^\s"']*/i.test(value);
  // Shell expansion can hide the literal state path.  A redirect to a
  // variable is therefore denied while the Harness scope is active.
  if (!runtimePath && !variableReference && !variableRedirect && !variableMutation) return false;
  // State may be inspected for diagnostics, but every shell form that can
  // write, replace, move or remove it must go through the transition runtime.
  // Allow only one read-only command with no shell composition or redirection;
  // a startsWith allowlist would let `cat state.json && echo ...` through.
  if (variableRedirect || variableMutation || /[;&|<>]/.test(value)) return true;
  const readOnly = /^\s*(?:cat|type|head|tail|more|Get-Content|gc|Select-String|grep|rg|sed\s+-n|git\s+(?:show|diff|status|ls-files|check-ignore))\b[^;&|<>]*$/i;
  return !readOnly.test(value);
}

const scope = await detectHarnessScope(root);
let output = decision(true);
if (scope === 'broken') {
  output = decision(false, 'Harness 接入不完整：请先修复 .codebuddy/harness.json 与 onboarding checklist。', 'harness_scope');
} else if (scope === 'absent') {
  // The plugin is globally installed, but ordinary projects must remain
  // completely inert until they explicitly opt into Harness initialization.
  console.log(JSON.stringify(output));
  process.exit(0);
}
if (/Write|Edit|write_to_file|replace_in_file/.test(toolName) && /(?:^|\/)\.codebuddy\/workflows\/[^/]+\/state\.json$/i.test(normalizedTarget)) {
  output = decision(false, 'Use the harness transition runtime; state.json is write-protected.', 'runtime_state_write');
} else if (/Write|Edit|write_to_file|replace_in_file/.test(toolName) && ['.gitignore', 'exclude'].includes(basename(normalizedTarget)) && ignoresSharedContract(proposedText)) {
  output = decision(false, 'Only .codebuddy/workflows/ may be ignored; keep shared Harness contracts tracked by Git.', 'ignore_shared_contract');
} else if (/Bash|execute_command/.test(toolName)) {
  const command = String(toolInput.command ?? toolInput.cmd ?? '');
  if (mutatesWorkflowState(command)) {
    output = decision(false, 'Use the harness transition runtime; shell commands cannot write, move or remove workflow state.json.', 'runtime_state_write');
  } else if (/(?:^|&&|\|\||[;|])\s*git\s+(?:-[^\s]+\s+)*commit(?:\s|$)/i.test(command)) {
    try {
      const gate = await runGateProfile(root, 'preCommit');
      if (!gate.ok) output = decision(false, `The configured preCommit gate failed: ${JSON.stringify(gate.checks)}`, 'precommit_gate');
    } catch (error) {
      output = decision(false, `The configured preCommit gate could not run: ${error.message}`, 'precommit_gate');
    }
  }
}

console.log(JSON.stringify(output));
