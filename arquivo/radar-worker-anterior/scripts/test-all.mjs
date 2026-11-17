import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const tests = readdirSync(new URL('.', import.meta.url)).filter(name => /^test-.*\.mjs$/.test(name) && name !== 'test-all.mjs').sort();
let failures = 0;
for (const test of tests) {
  console.log('\n' + test);
  const result = spawnSync(process.execPath, ['scripts/' + test], { cwd: root, stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    failures++;
    if (result.error) console.error(result.error.message);
  }
}
console.log('\n' + (tests.length - failures) + '/' + tests.length + ' arquivos de teste passaram.');
process.exitCode = failures ? 1 : 0;
