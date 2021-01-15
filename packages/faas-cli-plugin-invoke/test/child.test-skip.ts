import { invoke } from '../src/index';
import { join } from 'path';
import * as assert from 'assert';
import { existsSync, remove } from 'fs-extra';

describe('/test/index.test.ts', () => {
  afterEach(async () => {
    process.env.MIDWAY_TS_MODE = undefined;
    if (
      existsSync(
        join(__dirname, 'fixtures/ice-faas-ts-standard/.faas_debug_tmp')
      )
    ) {
      await remove(
        join(__dirname, 'fixtures/ice-faas-ts-standard/.faas_debug_tmp')
      );
    }
    if (
      existsSync(join(__dirname, 'fixtures/ice-faas-ts-standard/.tsbuildinfo'))
    ) {
      await remove(
        join(__dirname, 'fixtures/ice-faas-ts-standard/.tsbuildinfo')
      );
    }
  });

  it.only('should use origin http trigger', async () => {
    const originTsMode = process.env.MIDWAY_TS_MODE;
    process.env.MIDWAY_TS_MODE = 'false';
    let result: any = await invoke({
      functionDir: join(__dirname, 'fixtures/baseApp'),
      functionName: 'http',
      data: [{ name: 'params' }],
      clean: false,
    });
    result = await invoke({
      functionDir: join(__dirname, 'fixtures/baseApp'),
      functionName: 'http',
      data: [{ name: 'params' }],
      clean: false,
    });
    process.env.MIDWAY_TS_MODE = originTsMode;
    console.log('result', result);
    assert(result && result.body === 'hello http world');
    await remove(join(__dirname, 'fixtures/baseApp/.faas_debug_tmp'));
  });

  it('invoke use two step', async () => {
    const originTsMode = process.env.MIDWAY_TS_MODE;
    process.env.MIDWAY_TS_MODE = 'false';
    const invokeInstance: any = await invoke({
      getFunctionList: true,
      functionDir: join(__dirname, 'fixtures/baseApp'),
      clean: false,
    });
    assert(invokeInstance.functionList.http.handler === 'http.handler');
    assert(invokeInstance.invoke);
    const result = await invokeInstance.invoke({
      functionName: 'http',
      data: [{ name: 'params' }],
    });
    process.env.MIDWAY_TS_MODE = originTsMode;
    assert(existsSync(join(__dirname, 'fixtures/baseApp/.faas_debug_tmp')));
    assert(result && result.body === 'hello http world');
    await remove(join(__dirname, 'fixtures/baseApp/.faas_debug_tmp'));
  });
});
