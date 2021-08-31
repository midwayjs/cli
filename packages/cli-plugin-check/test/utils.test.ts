'use strict';
import { transformToRelative } from '../src/utils';
import * as assert from 'assert';
describe('test/utils.test.ts', () => {
  it('transformToRelative absolute', async () => {
    const path = transformToRelative('/a/b/c', '/x/y/z');
    assert(path === '../../../x/y/z');
  });
  it('transformToRelative relative', async () => {
    const path = transformToRelative('/a/b/c', '../x/y/z');
    assert(path === '../x/y/z');
  });
});
