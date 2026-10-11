// Offline installer peer. It only writes into the supplied isolated staging directory.
const fs = require('node:fs');
const path = require('node:path');
const home = process.env.CODEX_QUOTA_NPM_FIXTURE;
const scenario = JSON.parse(fs.readFileSync(path.join(home, 'npm-scenario.json'), 'utf8'));
const args = process.argv.slice(2);
fs.appendFileSync(path.join(home, 'npm-trace.jsonl'), JSON.stringify({ args, cwd: process.cwd(), pid: process.pid, electron: process.env.ELECTRON_RUN_AS_NODE }) + '\n');
if (scenario.hang) setInterval(() => {}, 1000);
else setTimeout(() => {
  if (scenario.fail) {
    process.stderr.write(scenario.stderr ?? 'SENSITIVE_NPM_TOKEN');
    process.exit(scenario.fail);
  }
  if (scenario.incomplete) process.exit(0);
  const root = path.join(args[args.indexOf('--prefix') + 1], 'node_modules', '@openai', 'codex');
  fs.mkdirSync(path.join(root, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: '@openai/codex', version: '0.162.1' }));
  fs.copyFileSync(path.join(__dirname, 'codex.cjs'), path.join(root, 'bin', 'codex.js'));
  const targets = { 'linux-x64': 'x86_64-unknown-linux-musl', 'linux-arm64': 'aarch64-unknown-linux-musl', 'darwin-x64': 'x86_64-apple-darwin', 'darwin-arm64': 'aarch64-apple-darwin', 'win32-x64': 'x86_64-pc-windows-msvc', 'win32-arm64': 'aarch64-pc-windows-msvc' };
  const vendor = path.join(root, 'vendor', targets[`${process.platform}-${process.arch}`], 'bin');
  fs.mkdirSync(vendor, { recursive: true });
  const binary = path.join(vendor, process.platform === 'win32' ? 'codex.exe' : 'codex');
  if (process.platform === 'win32') fs.copyFileSync(path.join(home, 'console-probe.exe'), binary);
  else { fs.writeFileSync(binary, '#!/bin/sh\nexit 0\n'); fs.chmodSync(binary, 0o755); }
}, scenario.delay ?? 0);
