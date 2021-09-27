'use strict';
import { runCheck } from './utils';
import * as assert from 'assert';
import { join } from 'path';
describe('test/config-export.test.ts', () => {
  it('export default and export named', async () => {
    const cwd = join(__dirname, 'fixtures/config-export');
    const logs = await runCheck(cwd);
    const logStr = logs.join('\n');
    assert(
      logStr.includes(
        'default and named export cannot coexist in local and daily environment config'
      )
    );
  });
});
