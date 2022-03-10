'use strict';
import { runCheck } from './utils';
import * as assert from 'assert';
import { join } from 'path';
import { exec } from '@midwayjs/command-core';
describe('test/hooks.test.ts', () => {
  it('imports hooks()', async () => {
    const cwd = join(__dirname, 'fixtures/hooks');
    await exec({
      baseDir: cwd,
      cmd: 'npm install',
    });
    const logs = await runCheck(cwd);
    const logStr = logs.join('\n');
    assert(logStr.includes('Need add hooks()'));
    assert(logStr.includes('config directory is required'));
  });
});
