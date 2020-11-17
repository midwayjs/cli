import { invoke } from '../src/index';
import { join } from 'path';
import * as assert from 'assert';
import { existsSync, remove } from 'fs-extra';

describe('/test/no-provider.test.ts', () => {
  it('should use origin http trigger', async () => {
    const originTsMode = process.env.MIDWAY_TS_MODE;
    process.env.MIDWAY_TS_MODE = 'false';
    const functionDir = join(__dirname, 'fixtures/baseApp-no-functions');
    const buildDir = join(functionDir, '.faas_debug_tmp');
    if (existsSync(buildDir)) {
      await remove(buildDir);
    }
    await invoke({
      functionDir,
      functionName: 'http',
      data: [{ name: 'params' }],
      clean: false,
    });
    const result = await invoke({
      functionDir,
      functionName: 'http',
      data: [{ name: 'params' }],
      clean: false,
    });
    process.env.MIDWAY_TS_MODE = originTsMode;
    assert(result.body === 'hello http world');
    if (existsSync(buildDir)) {
      await remove(buildDir);
    }
  });
});
