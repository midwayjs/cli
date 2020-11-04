import { formatUpperCamel, compareFileChange, copyStaticFiles } from '../src';
import { join } from 'path';
import { existsSync, writeFileSync, remove, mkdirSync } from 'fs-extra';
const base = join(__dirname, 'compareFileChange');
import * as assert from 'assert';
describe('faas-code-analysis:/test/utils.test.ts', () => {
  it('formatUpperCamel', async () => {
    const camel = formatUpperCamel('ABC');
    assert(camel === 'a-b-c');
  });

  it('compareFileChange', async () => {
    writeFileSync(join(base, 'a.txt'), Date.now());
    const fileChange = await compareFileChange(['*.txt'], ['*.data'], {
      cwd: base,
    });
    assert(fileChange[0] === 'a.txt');

    const noFrom = await compareFileChange(['*.zip'], ['*.data'], {
      cwd: base,
    });
    assert(noFrom.length === 0);

    const noTo = await compareFileChange(['*.txt'], ['*.zip'], {
      cwd: base,
    });
    assert(noTo.length === 1);
    assert(noTo[0] === 'a.txt');

    writeFileSync(join(base, 'b.data'), Date.now());
    const fileChange2 = await compareFileChange(['*.txt'], ['*.data'], {
      cwd: base,
    });
    assert(fileChange2.length === 0);
  });

  it('copyStaticFiles', async () => {
    await copyStaticFiles({ sourceDir: null, targetDir: null, log: null });
    const target = join(__dirname, 'tmpCopyFileDir');
    if (existsSync(target)) {
      await remove(target);
    }
    mkdirSync(target);
    await copyStaticFiles({
      sourceDir: base,
      targetDir: target,
      log: () => {},
    });
    assert(existsSync(join(target, 'a.txt')));
    assert(existsSync(join(target, 'b.data')));
    assert(!existsSync(join(target, 'c.ts')));

    await copyStaticFiles({
      sourceDir: base,
      targetDir: target,
      log: () => {},
    });
    await remove(target);
  });
});
