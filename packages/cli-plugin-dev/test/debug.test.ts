'use strict';
import { remove, existsSync } from 'fs-extra';
const fetch = require('node-fetch');
import { join } from 'path';
import { run } from './utils';
import * as assert from 'assert';
import { waitDebug } from '../src/utils';

const cwd = join(__dirname, 'fixtures/debug');
describe('test/debug.test.ts', () => {
  it('debug', async () => {
    const dist = join(cwd, 'dist');
    if (existsSync(dist)) {
      await remove(dist);
    }
    const { close, port, getData } = await run(cwd, {
      fast: true,
      debug: true,
    });
    const response = await fetch(`http://127.0.0.1:${port}/`);
    const body = await response.text();
    const functions = await getData('functions');
    assert(functions['homeService.hello']);
    assert(body === 'Hello Midwayjs');
    const send = await waitDebug(9229);
    assert(typeof send === 'function');
    await close();
  });
});
