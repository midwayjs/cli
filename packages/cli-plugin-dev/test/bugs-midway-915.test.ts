import { join } from 'path';
import { run } from './utils';
const fetch = require('node-fetch');
const cwd = join(__dirname, 'fixtures/faas-controller');
import * as assert from 'assert';
// bugs from https://github.com/midwayjs/midway/issues/915
describe.skip('/test/bugs-midway-915.test.ts', () => {
  it('get url', async () => {
    const { close, port } = await run(cwd, { silent: true, fast: false });
    const response = await fetch(`http://127.0.0.1:${port}/json`);
    const body = await response.text();
    await close();
    console.log('body', body);
    assert(body === 'json');
  });
});
