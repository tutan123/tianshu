const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const path=require('node:path');

/*
 * 麻将引擎由同事的《重生2-原型 v1.6》整体移植而来（见 assets/SOURCES.md）。
 * 它自带一套 531 项纯逻辑自测（vm 注入 + 最小 DOM stub，覆盖造牌 / 牌型判定 /
 * 赔付 / 抢杠 / AI 整局 / 向听数 / 提示 / 结算亮牌）。这里不重写那套断言，只把它
 * 挂进 verify.cmd 的自动发现里 —— 移植过来的代码有没有被改坏，由原作的测试说了算。
 * stdio 走 inherit，失败时 execFileSync 直接抛错。
 */
test('移植的赣麻引擎通过它原作自带的 531 项逻辑自测', () => {
  const script = path.join(__dirname, 'mahjong-logic.cjs');
  execFileSync(process.execPath, [script], { stdio: 'inherit', cwd: path.join(__dirname, '..') });
});