import {
  formatInvokeResult,
  getExportMidwayFaaS,
  setLock,
  getLock,
  waitForLock,
  LOCK_TYPE,
} from '../src/utils';
import * as assert from 'assert';

describe('/test/utils.test.ts', () => {
  it('formatInvokeResult', () => {
    try {
      formatInvokeResult({
        err: new Error('test error'),
      });
    } catch (e) {
      assert(/test error/.test(e.message));
    }
  });
  it('formatInvokeResult', () => {
    const originModuleName = process.env.MidwayModuleName;
    process.env.MidwayModuleName = 'not exists';
    const mod = getExportMidwayFaaS();
    process.env.MidwayModuleName = originModuleName;
    assert(mod.FaaSStarter.name === 'DefaulltMidwayFaasStarter');
  });
  it('setLock', () => {
    setLock('a', LOCK_TYPE.COMPLETE);
    const lock = getLock('a');
    assert(lock.lockType === LOCK_TYPE.INITIAL);
  });
  it('waitForLock auto complete', async () => {
    getLock('test');
    setLock('test', LOCK_TYPE.WAITING);
    await waitForLock('test', 99);
    setLock('test', LOCK_TYPE.COMPLETE);
    const lock = getLock('test');
    assert(lock.lockType === LOCK_TYPE.COMPLETE);
  });
});
