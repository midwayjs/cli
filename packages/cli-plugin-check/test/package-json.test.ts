'use strict';
import { runCheck } from './utils';
import * as assert from 'assert';
import { join } from 'path';
describe('test/package-json.test.ts', () => {
  it('deps', async () => {
    const cwd = join(__dirname, 'fixtures/package-json');
    const logs = await runCheck(cwd);
    const logStr = logs.join('\n');
    assert(logStr.includes('@midwayjs/cli-plugin-xxx'));
    assert(logStr.includes('@midwayjs/fcli-plugin-xxx'));
    assert(logStr.includes('@midwayjs/cli'));
    assert(logStr.includes('@midwayjs/faas-cli'));
    assert(logStr.includes('@xxx/faas-fun'));
    assert(logStr.includes('@xxx/faas-invoke'));
    assert(!logStr.includes('async'));
    assert(logStr.includes('tsconfig.json not exists'));
    assert(logStr.includes('can not check project type'));
    assert(logStr.includes('Yaml should have service config'));
    assert(logStr.includes('Yaml should have provider.name config'));
    assert(
      logStr.includes("function 'c' http.trigger.method type should be Array")
    );
    assert(logStr.includes('YAML package.exclude type should be Array'));
  });
});
