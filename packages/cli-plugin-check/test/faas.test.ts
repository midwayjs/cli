'use strict';
import { runCheck } from './utils';
import * as assert from 'assert';
import { join } from 'path';
import { ensureDir, existsSync, remove } from 'fs-extra';
import { writeFileSync } from 'fs';
import * as YAML from 'js-yaml';
describe('test/faas.test.ts', () => {
  it('check', async () => {
    const cwd = join(__dirname, 'fixtures/faas');
    const logs = await runCheck(cwd);
    const logStr = logs.join('\n');
    assert(logStr.includes('no tsCodeRoot'));
    assert(logStr.includes('can not check project type'));
    assert(logStr.includes('can not check project type'));
    assert(logStr.includes('not exist package.json'));
    assert(logStr.includes('Yaml should have service config'));
    assert(logStr.includes('Yaml should have provider config'));
  });
  it('passed', async () => {
    const cwd = join(__dirname, 'fixtures/faas-passed');
    const logs = await runCheck(cwd);
    const logStr = logs.join('\n');
    if (/v10/.test(process.version)) {
      assert(logStr.includes('Node Version'));
    } else {
      assert(logStr.includes('All Check Passed'));
    }
  });
  it('configuration', async () => {
    const cwd = join(__dirname, 'fixtures/faas-configuration');
    const logs = await runCheck(cwd);
    const logStr = logs.join('\n');
    assert(logStr.includes("'./config/') to import config"));
    assert(logStr.includes('tsconfig target need ≤ es2018'));
    assert(logStr.includes('YAML package.include type should be Array'));
    assert(logStr.includes("function 'test' http.trigger need path attribute"));
    assert(logStr.includes('class A can not export "default" in index.ts'));
  });
  it('configuration', async () => {
    const cwd = join(__dirname, 'fixtures/faas-config');
    const logs = await runCheck(cwd);
    const logStr = logs.join('\n');
    assert(logStr.includes('no prod or default config'));
    assert(
      logStr.includes(
        'there is a duplicate class name(A) in index.ts and index2.ts'
      )
    );
  });

  it('migrate to faas', async () => {
    const baseDir = join(__dirname, 'fixtures/migrate-to-faas');
    const migrateType = [
      { mod: '@midwayjs/koa', type: 'koa', deployType: '' },
      { mod: '@midwayjs/koa', type: 'koa', deployType: 'koa' },
      { mod: 'koa', type: 'koa' },
      { mod: 'koa', type: 'koa', deployType: 'koa' },
      { mod: '@midwayjs/express', type: 'express' },
      { mod: '@midwayjs/express', type: 'express', deployType: 'express' },
      { mod: 'express', type: 'express' },
      { mod: 'express', type: 'express', deployType: 'express' },
      { mod: '@midwayjs/web', type: 'egg' },
      { mod: '@midwayjs/web', type: 'egg', deployType: 'egg' },
      { mod: 'egg', type: 'egg' },
      { mod: 'egg', type: 'egg', deployType: 'egg' },
    ];

    for (const typeInfo of migrateType) {
      const testDir = join(baseDir, 'run');
      if (existsSync(testDir)) {
        await remove(testDir);
      }
      await ensureDir(testDir);
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ dependencies: { [typeInfo.mod]: '*' } })
      );
      writeFileSync(
        join(testDir, 'f.yml'),
        YAML.dump(
          typeInfo.deployType ? { deployType: typeInfo.deployType } : {}
        )
      );
      const logs = await runCheck(testDir);
      const logStr = logs.join('\n');
      if (!typeInfo.deployType) {
        assert(
          logStr.includes(
            `Deploying ${typeInfo.type} as FAAS requires configuring the deployType as ${typeInfo.type} in the f.yml file`
          )
        );
      } else {
        assert(!logStr.includes(`Deploying ${typeInfo.type} as FAAS`));
      }
    }
  });
});
