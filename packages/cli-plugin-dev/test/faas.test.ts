'use strict';
import { join } from 'path';
import { run } from './utils';
import * as assert from 'assert';
const fetch = require('node-fetch');
const cwd = join(__dirname, 'fixtures/faas');
describe('test/faas.test.ts', () => {
  it('dev', async () => {
    const { close, port } = await run(cwd, { silent: true });
    const response = await fetch(`http://127.0.0.1:${port}/hello?name=midway`);
    const body = await response.text();
    await close();
    assert(body === 'hello world,midway');
  });
});
