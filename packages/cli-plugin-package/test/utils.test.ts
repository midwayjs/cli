import { findModuleFromNodeModules, copyFromNodeModules } from '../src/utils';
import { join } from 'path';
import * as assert from 'assert';
import { execSync } from 'child_process';
import { existsSync, remove } from 'fs-extra';
import { readFileSync } from 'fs';
const demoDir = join(__dirname, './fixtures/fast-nm-install');
const nm = join(demoDir, 'node_modules');
describe('/test/utils.test.ts', () => {
  beforeAll(async () => {
    if (existsSync(nm)) {
      await remove(nm);
    }
    execSync(`cd ${demoDir};npm install`);
  });
  it('findModuleFromNodeModules', async () => {
    const deps = JSON.parse(
      readFileSync(join(demoDir, 'package.json')).toString()
    ).dependencies;
    const moduleInfoList = Object.keys(deps).map(name => {
      return {
        name,
        version: deps[name],
      };
    });
    const copyResult = await findModuleFromNodeModules(moduleInfoList, nm, nm);
    assert(Object.keys(copyResult).length > 1);
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
    const target = join(demoDir, 'node_modules2');
    if (existsSync(target)) {
      await remove(target);
    }
    const start = Date.now();
    const copyResult = await copyFromNodeModules(moduleInfoList, nm, target);
    const useTime = Date.now() - start;
    console.log('useTime', useTime);
    assert(copyResult.length);
  });
  it('not exists', async () => {
    const copyResult = await findModuleFromNodeModules(
      [{ name: 'xxx', version: '*' }],
      nm,
      nm
    );
    assert(!copyResult);
  });
  it('not match version', async () => {
    const deps = JSON.parse(
      readFileSync(join(demoDir, 'package.json')).toString()
    ).dependencies;
    const moduleInfoList = Object.keys(deps).map(name => {
      return {
        name: name + 'x',
        version: '^100',
      };
    });
    const copyResult = await findModuleFromNodeModules(moduleInfoList, nm, nm);
    assert(!copyResult);
  });
});
