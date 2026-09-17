import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

async function text(path) {
  return readFile(join(pluginRoot, ...path.split('/')), 'utf8');
}

test('initialization roles have disjoint knowledge ownership and runtime owns the file tree', async () => {
  const [business, engineering, rules, skill] = await Promise.all([
    text('agents/business-knowledge-writer.md'),
    text('agents/engineering-knowledge-writer.md'),
    text('agents/rules-writer.md'),
    text('skills/harness/SKILL.md')
  ]);

  assert.match(business, /写入范围：`docs\/function\/\*\*`、`docs\/knowledge\/业务入口\.md`/);
  assert.match(engineering, /docs\/knowledge\/api\/\*\*.*docs\/knowledge\/data\/\*\*.*docs\/knowledge\/integration\/\*\*.*docs\/knowledge\/decisions\/\*\*/s);
  assert.match(rules, /写入范围：`\.codebuddy\/rules\/\*\.md`/);
  for (const agent of [business, engineering, rules]) assert.match(agent, /不得写入 `docs\/knowledge\/文件树\.md`/);
  assert.match(skill, /`docs\/knowledge\/文件树\.md` 仅由运行时写入/);
});

test('subagents are bounded by tools, turns and a finite source batch', async () => {
  const [business, engineering, rules, reviewer] = await Promise.all([
    text('agents/business-knowledge-writer.md'),
    text('agents/engineering-knowledge-writer.md'),
    text('agents/rules-writer.md'),
    text('agents/code-reviewer.md')
  ]);
  for (const writer of [business, engineering]) {
    assert.match(writer, /^tools: Read, Write, Edit$/m);
    assert.match(writer, /^maxTurns: 8$/m);
    assert.match(writer, /^effort: medium$/m);
    assert.doesNotMatch(writer, /^tools:.*(?:Glob|Grep)/m);
    assert.match(writer, /20 个可读文件/);
    assert.match(writer, /拒绝执行/);
  }
  assert.match(rules, /^tools: Read, Write, Edit$/m);
  assert.match(rules, /^maxTurns: 8$/m);
  assert.match(rules, /^effort: low$/m);
  assert.match(reviewer, /^tools: Read, Glob, Grep$/m);
  assert.match(reviewer, /^maxTurns: 12$/m);
  assert.match(reviewer, /^effort: high$/m);
});

test('initialization keeps source contents out of the main Agent context', async () => {
  const initialization = await text('skills/harness/references/initialization.md');
  assert.match(initialization, /运行时.*盘点路径/s);
  assert.match(initialization, /主 Agent 不读取源文件内容/);
  assert.match(initialization, /每个 writer 实例.*20 个可读文件/s);
});
