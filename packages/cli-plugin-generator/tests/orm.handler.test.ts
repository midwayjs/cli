import { CommandCore } from '@midwayjs/command-core';
import { loadSpec } from '@midwayjs/serverless-spec-builder';
import { resolve, join } from 'path';
import { existsSync, remove, readFileSync } from 'fs-extra';
import * as assert from 'assert';
import consola from 'consola';
import jsonfile from 'jsonfile';

import { GeneratorPlugin } from '../src/index';

describe.skip('tmp', () => {
  const baseDir = resolve(__dirname, './fixtures/base');

  afterEach(async () => {
    await remove(join(baseDir, 'package-lock.json'));
    await remove(join(baseDir, 'node_modules'));
  });

  it('should execute setup', async () => {
    // const core = new CommandCore({
    //   config: {
    //     servicePath: baseDir,
    //   },
    //   commands: ['gen'],
    //   options: {},
    //   log: consola,
    //   cwd: baseDir,
    // });
    // core.addPlugin(GeneratorPlugin);
    // await core.ready();
    // await core.invoke(['gen', 'orm', 'setup']);
    // // deps
    // const pkg = jsonfile.readFileSync(resolve(baseDir, 'package.json'));
    // expect(Object.keys(pkg.dependencies).includes('@midwayjs/orm'));
    // expect(Object.keys(pkg.dependencies).includes('sqlite'));
    // configuration
    // expect(
    //   readFileSync(resolve(baseDir, 'src/configuration.ts'), {
    //     encoding: 'utf-8',
    //   }).includes("import * as orm from '@midwayjs/orm'")
    // );
    // expect(
    //   readFileSync(resolve(baseDir, 'src/configuration.ts'), {
    //     encoding: 'utf-8',
    //   }).includes('imports: [orm]')
    // );
    // expect(
    //   readFileSync(resolve(baseDir, 'src/config/config.default.ts'), {
    //     encoding: 'utf-8',
    //   }).includes('export const orm = { type: "sqlit111e" }')
    // );
    // config
  });
});
