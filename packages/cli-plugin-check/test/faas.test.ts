'use strict';
import { runCheck } from './utils';
import * as assert from 'assert';
import { join } from 'path';
describe('test/faas.test.ts', () => {
  it('check', async () => {
    const cwd = join(__dirname, 'fixtures/faas');
    const logs = await runCheck(cwd);
    const logStr = logs.join('\n');
    assert(logStr.includes('no tsCodeRoot'));
    assert(logStr.includes('can not check project type'));
    assert(logStr.includes('can not check project type'));
    assert(logStr.includes('not exist package.json'));
    assert(logStr.includes('Yaml should have service config'));
    assert(logStr.includes('Yaml should have provider config'));
  });
  it('passed', async () => {
    const cwd = join(__dirname, 'fixtures/faas-passed');
    const logs = await runCheck(cwd);
    const logStr = logs.join('\n');
    if (/v10/.test(process.version)) {
      assert(logStr.includes('Node Version'));
    } else {
      assert(logStr.includes('All Check Passed'));
    }
  });
  it('configuration', async () => {
    const cwd = join(__dirname, 'fixtures/faas-configuration');
    const logs = await runCheck(cwd);
    const logStr = logs.join('\n');
    assert(logStr.includes("'./config/') to import config"));
    assert(logStr.includes('tsconfig target need ≤ es2018'));
    assert(logStr.includes('YAML package.include type should be Array'));
    assert(logStr.includes("function 'test' http.trigger need path attribute"));
  });
  it('configuration', async () => {
    const cwd = join(__dirname, 'fixtures/faas-config');
    const logs = await runCheck(cwd);
    const logStr = logs.join('\n');
    assert(logStr.includes('no prod or default config'));
  });
});
