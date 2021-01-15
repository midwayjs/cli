'use strict';
import * as assert from 'assert';
import { resolve } from 'path';
import { Check } from '../src';
const getResult = baseDir => {
  const checkInstance = new Check(baseDir, 'src');
  return checkInstance.analysis();
};
describe('test/check.test.ts', () => {
  it('provide not export', async () => {
    const result = await getResult(resolve(__dirname, './fixtures/not-export'));
    assert(result.length === 1);
    assert(result[0].level === 'error');
    assert(result[0].message.indexOf('没有导出') !== -1);
  });
  it('inject not provide', async () => {
    const result = await getResult(
      resolve(__dirname, './fixtures/inject-not-provide')
    );
    assert(result.length === 2);
    assert(result[0].level === 'warn');
    assert(result[0].message.indexOf('Inject') !== -1);
    assert(result[0].message.indexOf('的属性') !== -1);
    assert(result[0].message.indexOf('没有在') !== -1);
  });
});
