'use strict';
import { join } from 'path';
import { wait, run } from './utils';
import * as assert from 'assert';

const cwd = join(__dirname, 'fixtures/faas');
describe('test/faas.test.ts', () => {
  it.skip('dev', async () => {
    const { close } = await run(cwd, {
      framework: 'faas',
    });
    await wait();
    await close();
    assert(true);
  });
});
