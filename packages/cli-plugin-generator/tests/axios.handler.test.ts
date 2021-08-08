import { CommandCore } from '@midwayjs/command-core';
import { loadSpec } from '@midwayjs/serverless-spec-builder';
import { resolve, join } from 'path';
import {
  existsSync,
  remove,
  readFileSync,
  copyFile,
  copyFileSync,
} from 'fs-extra';
import * as assert from 'assert';
import consola from 'consola';
import jsonfile from 'jsonfile';
import execa from 'execa';
import { GeneratorPlugin } from '../src/index';

import { AXIOS_DEP } from '../src/core/external/axios.handler';

describe.only('tmp', () => {
  beforeAll(() => {
    jest.setTimeout(300000);
  });

  beforeEach(async () => {
    await execa('node ./tests/copy.js', {
      cwd: process.cwd(),
      shell: true,
      stdio: 'inherit',
    });
  });

  const baseDir = resolve(__dirname, './fixtures/base');
  const sourceDir = resolve(__dirname, './fixtures/source');

  it('should install required deps only', async () => {
    const core = new CommandCore({
      config: {
        servicePath: baseDir,
      },
      commands: ['gen'],
      options: {},
      log: consola,
      cwd: baseDir,
    });
    core.addPlugin(GeneratorPlugin);

    await core.ready();
    await core.invoke(['gen', 'axios']);

    const pkg = jsonfile.readFileSync(resolve(baseDir, 'package.json'));

    expect(Object.keys(pkg?.dependencies ?? {})).toEqual(AXIOS_DEP);
  });

  it('should transform source code', async () => {
    const core = new CommandCore({
      config: {
        servicePath: baseDir,
      },
      commands: ['gen'],
      options: {},
      log: consola,
      cwd: baseDir,
    });
    core.addPlugin(GeneratorPlugin);

    await core.ready();
    await core.invoke(['gen', 'axios']);

    // should validate by AST(morpher?)
    expect(
      readFileSync(resolve(baseDir, './src/configuration.ts'), {
        encoding: 'utf-8',
      }).includes('import * as axios from "@midwayjs/axios"')
    ).toBeTruthy();

    expect(
      readFileSync(resolve(baseDir, './src/configuration.ts'), {
        encoding: 'utf-8',
      }).includes('[axios]')
    ).toBeTruthy();
  });

  it('should use specified namespace', async () => {
    const core = new CommandCore({
      config: {
        servicePath: baseDir,
      },
      commands: ['gen'],
      options: {},
      log: consola,
      cwd: baseDir,
    });
    core.addPlugin(GeneratorPlugin);

    await core.ready();
    await core.invoke(['gen', 'axios'], undefined, {
      namespace: 'http',
    });

    // should validate by AST(morpher?)
    expect(
      readFileSync(resolve(baseDir, './src/configuration.ts'), {
        encoding: 'utf-8',
      }).includes('import * as http from "@midwayjs/axios"')
    ).toBeTruthy();

    expect(
      readFileSync(resolve(baseDir, './src/configuration.ts'), {
        encoding: 'utf-8',
      }).includes('[http]')
    ).toBeTruthy();
  });

  it('should not actually work in dry run mode', async () => {
    const core = new CommandCore({
      config: {
        servicePath: baseDir,
      },
      commands: ['gen'],
      options: {},
      log: consola,
      cwd: baseDir,
    });
    core.addPlugin(GeneratorPlugin);

    await core.ready();
    await core.invoke(['gen', 'axios'], undefined, {
      dry: true,
    });
    const pkg = jsonfile.readFileSync(resolve(baseDir, 'package.json'));

    expect(Object.keys(pkg?.dependencies ?? {})).not.toEqual(AXIOS_DEP);

    // should validate by AST(morpher?)
    expect(
      readFileSync(resolve(baseDir, './src/configuration.ts'), {
        encoding: 'utf-8',
      }).includes('import * as http from "@midwayjs/axios"')
    ).toBeFalsy();

    expect(
      readFileSync(resolve(baseDir, './src/configuration.ts'), {
        encoding: 'utf-8',
      }).includes('[axios]')
    ).toBeFalsy();
  });
});
