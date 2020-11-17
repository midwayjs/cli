import { invoke } from '../src/index';
import { join } from 'path';
import * as assert from 'assert';
import { existsSync, remove } from 'fs-extra';

describe('/test/no-provider.test.ts', () => {
  it('should use origin http trigger', async () => {
    const functionDir = join(__dirname, 'fixtures/baseApp-no-provider');
    const buildDir = join(functionDir, '.faas_debug_tmp');
    if (existsSync(buildDir)) {
      await remove(buildDir);
    }
    try {
      await invoke({
        functionDir,
        functionName: 'a',
        data: [{ name: 'params' }],
        clean: false,
      });
    } catch (e) {
      assert(/Current provider 'unknow' not support/.test(e.message));
    }
    if (existsSync(buildDir)) {
      await remove(buildDir);
    }
  });
});
