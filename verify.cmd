@echo off
rem 一键验证：单元测试 + 全部浏览器验收。
rem 用法: verify.cmd            全部
rem       verify.cmd --unit     只跑单元测试（不需要 playwright）
rem       verify.cmd --browser  只跑浏览器验收
cd /d "%~dp0"
node tests\verify.cjs %*
