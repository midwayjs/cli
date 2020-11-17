import { invoke } from '../src/index';
import { join } from 'path';
import * as assert from 'assert';
import { existsSync, remove } from 'fs-extra';
describe('/test/main.test.ts', () => {
  it('invoke', async () => {
    const dir = join(__dirname, 'fixtures/baseApp');
    const debugTmp = join(dir, '.faas_debug_tmp');
    if (existsSync(debugTmp)) {
      await remove(debugTmp);
    }
    const result: any = await (invoke as any)({
      functionDir: join(__dirname, 'fixtures/baseApp'),
      functionName: 'http',
      clean: false,
    });
    assert(result.body === 'hello http world');
  });
});
