import { execSync } from 'child_process';
import { join } from 'path';
import { remove, existsSync, readFileSync, mkdirSync } from 'fs-extra';
import * as assert from 'assert';

describe('/test/create.test.ts', () => {
  const baseDir = join(__dirname, './tmp');
  it('f create', async () => {
    if (existsSync(baseDir)) {
      await remove(baseDir);
    }
    mkdirSync(baseDir);
    execSync(
      `cd ${baseDir};${join(
        __dirname,
        '../bin/cli.js'
      )} create --template faas-standard --path my_serverless`
    );
    assert(existsSync(join(baseDir, 'my_serverless/f.yml')));
    assert(existsSync(join(baseDir, 'my_serverless/src')));
    assert(existsSync(join(baseDir, 'my_serverless/test')));
    assert(existsSync(join(baseDir, 'my_serverless/tsconfig.json')));
    assert(existsSync(join(baseDir, 'my_serverless/package.json')));
    const contents = readFileSync(
      join(baseDir, 'my_serverless/f.yml'),
      'utf-8'
    );
    assert(/serverless-hello-world/.test(contents));
    await remove(baseDir);
  });
  it('f invoke', async () => {
    const invokeBaseDir = join(__dirname, './fixtures/invoke');
    const result = execSync(
      `${join(__dirname, '../bin/cli.js')} invoke -f index --clean=true`,
      {
        cwd: invokeBaseDir,
        env: {
          ...process.env,
          MIDWAY_TS_MODE: 'false',
        },
      }
    ).toString();
    assert(/hello http world/.test(result));
  });
  it('f test', async () => {
    const testBaseDir = join(__dirname, './fixtures/test');
    const result = execSync(`${join(__dirname, '../bin/cli.js')} test`, {
      cwd: testBaseDir,
      env: process.env,
    }).toString();
    assert(/Testing all \*\.test\.ts/.test(result));
  });
  it('f package', async () => {
    const packageBaseDir = join(__dirname, './fixtures/package');
    const result = join(packageBaseDir, 'xxx.zip');
    if (existsSync(result)) {
      await remove(result);
    }
    execSync(`${join(__dirname, '../bin/cli.js')} package`, {
      cwd: packageBaseDir,
      env: process.env,
    }).toString();
    assert(existsSync(result));
  });
});
