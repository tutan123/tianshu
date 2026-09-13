#!/usr/bin/env node
'use strict';
/*
 * One-command verification for 天枢 · 重返江大.
 *
 *   node tests/verify.cjs            unit tests + every browser acceptance suite
 *   node tests/verify.cjs --unit     unit tests only (no browser needed)
 *   node tests/verify.cjs --browser  browser acceptance suites only
 *
 * Files are DISCOVERED, never hand-listed, so a new tests/*.test.cjs or
 * tests/*.acceptance.js is picked up automatically and cannot be forgotten.
 *
 * The game itself runs from file:// with zero installs. Only the browser suites
 * need playwright-core (which reuses the locally installed Chrome — no browser
 * download). Missing playwright is reported as a failure, not silently skipped.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const testsDir = path.join(root, 'tests');
const unitOnly = process.argv.includes('--unit');
const browserOnly = process.argv.includes('--browser');

const unitFiles = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.cjs')).sort();
const suiteFiles = fs.readdirSync(testsDir).filter(f => /\.acceptance\.(js|mjs)$/.test(f)).sort();

function playwrightModule() {
  for (const name of ['playwright-core', 'playwright']) {
    try { return require.resolve(name, { paths: [root, __dirname] }) && name; } catch { /* try next */ }
  }
  return null;
}

function step(label, args) {
  const started = Date.now();
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  return { label, ok: result.status === 0, ms: Date.now() - started };
}

const results = [];
let fatal = null;

if (!browserOnly) {
  if (!unitFiles.length) fatal = 'No tests/*.test.cjs found.';
  else {
    console.log(`\n=== 单元测试 (${unitFiles.length} 个文件) ===`);
    results.push(step('unit', ['--test', ...unitFiles.map(f => path.join('tests', f))]));
  }
}

if (!unitOnly && !fatal) {
  const pw = playwrightModule();
  if (!pw) {
    fatal = [
      'Browser acceptance suites need playwright-core.',
      'The game itself still runs by double-clicking 开始游戏.cmd — this affects verification only.',
      `Install once with:  npm install        (inside ${root})`,
    ].join('\n  ');
  } else {
    console.log(`\n=== 浏览器验收 (${suiteFiles.length} 套, 使用 ${pw}) ===`);
    for (const file of suiteFiles) {
      const report = path.join('tests', file.replace(/\.acceptance\.(js|mjs)$/, '-results.json'));
      const outcome = step(file, [path.join('tests', 'run-browser.cjs'), path.join('tests', file)]);
      let checks = null;
      try { checks = JSON.parse(fs.readFileSync(path.join(root, report), 'utf8')).checks?.length ?? null; } catch { /* result file absent */ }
      outcome.checks = checks;
      results.push(outcome);
    }
  }
}

console.log('\n=== 汇总 ===');
let failed = 0;
for (const r of results) {
  const label = r.label === 'unit' ? `单元测试 (${unitFiles.length} 个文件)` : r.label;
  const suffix = r.checks === null || r.checks === undefined ? '' : `  ${r.checks} 项检查`;
  console.log(`  ${r.ok ? '通过' : '失败'}  ${label}${suffix}  ${(r.ms / 1000).toFixed(1)}s`);
  if (!r.ok) failed++;
}
if (fatal) { console.log(`\n错误: ${fatal}`); failed++; }

if (failed) {
  console.log(`\n${failed} 项失败。验收结果 JSON 已写入 tests/*-results.json，截图在 tests/screenshots/。\n`);
  process.exitCode = 1;
} else {
  const totalChecks = results.reduce((sum, r) => sum + (r.checks || 0), 0);
  console.log(`\n全部通过。浏览器验收共 ${totalChecks} 项检查。\n`);
}
