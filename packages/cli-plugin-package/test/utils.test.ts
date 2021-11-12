import { copyFromNodeModules } from '../src/utils';

import { join } from 'path';
// import { execSync } from 'child_process';
// import { existsSync, remove } from 'fs-extra';
import { readFileSync } from 'fs';

describe('/test/utils.test.ts', () => {
  it('copyFromNodeModules', async () => {
    const demoDir = join(__dirname, './fixtures/fast-nm-install');
    const nm = join(demoDir, 'node_modules');
    // if (existsSync(nm)) {
    //   await remove(nm);
    // }
    // execSync(`cd ${demoDir};cnpm install`);
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
    console.log('copyResult', copyResult);
  });
});
