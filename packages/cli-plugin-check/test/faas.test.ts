'use strict';
import { runCheck } from './utils';
import * as assert from 'assert';
import { join } from 'path';
describe('test/faas.test.ts', () => {
  it('check', async () => {
    const cwd = join(__dirname, 'fixtures/faas');
    await runCheck(cwd);
    assert(true);
  });
});
