import { copyFromNodeModules } from '../src/utils';
import { join } from 'path';
import * as assert from 'assert';
// import { execSync } from 'child_process';
// import { existsSync, remove } from 'fs-extra';
import { readFileSync } from 'fs';
const demoDir = join(__dirname, './fixtures/fast-nm-install');
const nm = join(demoDir, 'node_modules');
describe('/test/utils.test.ts', () => {
  beforeAll(async () => {
    // if (existsSync(nm)) {
    //   await remove(nm);
    // }
    // execSync(`cd ${demoDir};cnpm install`);
  });
  it('copyFromNodeModules', async () => {
    const deps = JSON.parse(
      readFileSync(join(demoDir, 'package.json')).toString()
    ).dependencies;
    const moduleInfoList = Object.keys(deps).map(name => {
      return {
        name,
        version: deps[name],
      };
    });
    const copyResult = await copyFromNodeModules(
      moduleInfoList,
      nm,
      nm,
      join(demoDir, 'node_modules2')
    );
    assert(Object.keys(copyResult).length > 1);
  });
  it('not exists', async () => {
    const copyResult = await copyFromNodeModules(
      [{ name: 'xxx', version: '*' }],
      nm,
      nm,
      join(demoDir, 'node_modules2')
    );
    assert(!copyResult);
  });
  it('not match version', async () => {
    const deps = JSON.parse(
      readFileSync(join(demoDir, 'package.json')).toString()
    ).dependencies;
    const moduleInfoList = Object.keys(deps).map(name => {
      return {
        name,
        version: '^100',
      };
    });
    const copyResult = await copyFromNodeModules(
      moduleInfoList,
      nm,
      nm,
      join(demoDir, 'node_modules2')
    );
    assert(!copyResult);
  });
});
