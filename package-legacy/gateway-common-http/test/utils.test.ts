import * as assert from 'assert';
import { getHeaderValue, getQuery, getPath } from '../src/utils';
describe('/test/utils.test.ts', () => {
  it('test getHeaderValue', () => {
    assert(getHeaderValue(undefined, 'test') === undefined);
    assert(getHeaderValue({ test: [123] }, 'test') === 123);
    assert(getHeaderValue({ a: [123] }, 'b') === undefined);
    assert(getHeaderValue({ a: [123, 456] }, 'a').length === 2);
  });
  it('test getQuery', () => {
    assert(getQuery(undefined) === undefined);
    assert(getQuery({}) === undefined);
    assert(getQuery({ query: { name: 123 } }).name === 123);
    assert(getQuery({ url: '/?name=aaaa#123' }).name === 'aaaa');
    assert(getQuery({ url: '/#xxx?name=aaaa' }).name === undefined);
    assert(getQuery({ originalUrl: '/?name=aaaa#123' }).name === 'aaaa');
    assert(getQuery({ originalUrl: '/#xxx?name=aaaa' }).name === undefined);
  });
  it('test getPath', () => {
    assert(getPath(undefined) === '');
    assert(getPath({}) === '');
    assert(getPath({ url: '/?name=aaaa#123' }) === '/');
    assert(getPath({ url: '/#xxx?name=aaaa' }) === '/');
    assert(getPath({ originalUrl: '/?name=aaaa#123' }) === '/');
    assert(getPath({ originalUrl: '/#xxx?name=aaaa' }) === '/');
  });
});
