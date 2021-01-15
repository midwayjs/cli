'use strict';
import { doing } from './fixtures/base';
import * as assert from 'assert';
describe('test/index.test.ts', () => {
  it('base', async () => {
    const result = await doing();
    assert(result.fun.toString().indexOf("'xxxx'"));
    assert(result.number === 123);
    assert(result.string === 'str');
    assert(result.obj.arr[0] === 'a');
    assert(result.obj.arr[1] === 2);
    assert(result.obj.arr[2] === false);
    assert(result.obj.bool === true);
    assert(result.funResult === 'xxxx');
  });
});
