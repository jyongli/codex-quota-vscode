// An isolated protocol peer. It never reads real Codex credentials or uses the network.
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const home = process.env.CODEX_HOME;
const scenario = JSON.parse(fs.readFileSync(path.join(home, 'scenario.json'), 'utf8'));
const trace = path.join(home, 'trace.jsonl');
fs.appendFileSync(trace, JSON.stringify({ pid: process.pid, args: process.argv.slice(2), electronRunAsNode: process.env.ELECTRON_RUN_AS_NODE }) + '\n');
let initialized = false;
let accountReads = 0;
const defaultAccount = { type: 'chatgpt', email: 'fixture@example.test', planType: 'plus' };
let writes = Promise.resolve();
const send = response => {
  const line = JSON.stringify(response) + '\n';
  writes = writes.then(async () => {
    if (scenario.fragmented) {
      process.stdout.write(line.slice(0, 7));
      await new Promise(resolve => setTimeout(resolve, 5));
      process.stdout.write(line.slice(7));
    } else process.stdout.write(line);
  });
};
readline.createInterface({ input: process.stdin }).on('line', line => {
  const request = JSON.parse(line);
  fs.appendFileSync(trace, JSON.stringify(request) + '\n');
  if (request.method === 'initialized') { initialized = true; return; }
  if (scenario.hang || scenario.hangMethod === request.method) return;
  if (scenario.exit || scenario.exitMethod === request.method) {
    process.stderr.write(scenario.stderr ?? '', () => process.exit(4));
    return;
  }
  if (scenario.malformed) { process.stdout.write('not-json\n'); return; }
  if (scenario.huge) { process.stdout.write('x'.repeat(2_000_000)); return; }
  if (request.method === 'initialize') {
    send({ id: request.id, result: { userAgent: 'fixture', codexHome: home } });
    return;
  }
  if (!initialized) {
    send({ id: request.id, error: { code: -32600, message: 'Not initialized' } });
    return;
  }
  if (request.method === 'account/read') {
    accountReads++;
    const account = scenario.account === undefined ? defaultAccount : scenario.account;
    send({ id: request.id, result: { account: scenario.changeAccount && accountReads > 1
      ? { ...defaultAccount, email: 'other@example.test' } : account, requiresOpenaiAuth: true } });
    return;
  }
  if (request.method === 'account/rateLimits/read') {
    if (scenario.error) {
      process.stderr.write('SENSITIVE_MOCK_TOKEN\n');
      send({ id: request.id, error: { code: scenario.error, message: 'SENSITIVE_MOCK_TOKEN' } });
      return;
    }
    const result = scenario.quota ?? { rateLimits: {
      primary: { usedPercent: 25, windowDurationMins: 300, resetsAt: 2_000_000_000 },
      secondary: { usedPercent: 40, windowDurationMins: 10080, resetsAt: 2_000_500_000 }
    } };
    const respond = () => {
      send({ method: 'account/rateLimits/updated', params: { ignored: true } });
      send({ id: request.id, result });
    };
    if (scenario.delay) setTimeout(respond, scenario.delay); else respond();
    return;
  }
  send({ id: request.id, error: { code: -32601, message: 'Unknown method' } });
});
