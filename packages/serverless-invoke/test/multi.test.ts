import { invoke } from '../src/index';
import { join } from 'path';
import * as assert from 'assert';
import { pathExists, remove } from 'fs-extra';

describe('/test/multi.test.ts', () => {
  beforeEach(async () => {
    const dirs = [join(__dirname, './fixtures/multiApp')];
    for (const dir of dirs) {
      if (await pathExists(join(dir, '.faas_debug_tmp'))) {
        await remove(join(dir, '.faas_debug_tmp'));
      }
    }
  });
  it('two at same time', async () => {
    const MIDWAY_TS_MODE = process.env.MIDWAY_TS_MODE;
    process.env.MIDWAY_TS_MODE = 'false';
    const result = await Promise.all(
      ['http', 'a', 'c', 'http', 'a', 'c'].map((functionName: string) => {
        return invoke({
          functionDir: join(__dirname, 'fixtures/multiApp'),
          functionName,
          data: [
            {
              headers: { 'Content-Type': 'text/json' },
              method: 'GET',
              path: '/test/xxx',
              query: { name: 123 },
              body: {
                name: 'test',
              },
            },
          ],
          clean: false,
        });
      })
    );
    process.env.MIDWAY_TS_MODE = MIDWAY_TS_MODE;
    assert(result.length === 6);
    assert(result[1].body === 'abc');
    assert(result[2].body === '123');
    assert(result[4].body === 'abc');
    assert(result[5].body === '123');
  });
});
