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
    assert(logStr.includes('can not check faas project type'));
    assert(logStr.includes('ts-node needs to be upgrated to version 10'));
    assert(
      logStr.includes(
        'you can no longer use the f command after using @midwayjs/cli'
      )
    );
    assert(logStr.includes('Yaml should have service config'));
    assert(logStr.includes('Yaml should have provider.name config'));
    assert(
      logStr.includes("function 'c' http.trigger.method type should be Array")
    );
    assert(logStr.includes('YAML package.exclude type should be Array'));
  });
  it('midway version', async () => {
    const cwd = join(__dirname, 'fixtures/midway-version');
    const logs = await runCheck(cwd);
    const logStr = logs.join('\n');
    assert(logStr);
  });
  it('midway compnents version', async () => {
    const cwd = join(__dirname, 'fixtures/midway-components-version');
    const logs = await runCheck(cwd);
    const logStr = logs.join('\n');
    assert(
      logStr.includes(
        '@midwayjs/core@2 and @midwayjs/cache@^3, @midwayjs/jwt@latest, @midwayjs/oss@beta are incompatible, please use @midwayjs/cache@2, @midwayjs/jwt@2, @midwayjs/oss@2'
      )
    );
  });
});
