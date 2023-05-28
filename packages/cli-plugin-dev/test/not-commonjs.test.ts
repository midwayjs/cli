'use strict';
import { remove, existsSync, copy, readFileSync } from 'fs-extra';
const fetch = require('node-fetch');
import { join } from 'path';
import { run } from './utils';
import * as assert from 'assert';

const cwd = join(__dirname, 'fixtures/not-commonjs');
describe.skip('test/not-commonjs.test.ts', () => {
  it('dev', async () => {
    const tsConfigFile = join(cwd, 'tsconfig.json');
    if (existsSync(tsConfigFile)) {
      await remove(tsConfigFile);
    }
    await copy(join(cwd, 'tsconfig.json.origin'), tsConfigFile);
    const { close, port, getData } = await run(cwd, {
      silent: true,
      fast: false,
    });
    const response = await fetch(`http://127.0.0.1:${port}/hello?name=midway`);
    const body = await response.text();
    const functions = await getData('functions');
    await close();
    const tsconfig = JSON.parse(readFileSync(tsConfigFile).toString());
    await remove(tsConfigFile);
    assert(functions.http);
    assert(body === 'hello world,midway');
    assert(tsconfig['ts-node'].compilerOptions.module === 'commonjs');
  });
});
