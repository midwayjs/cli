import { CommandCore, findNpm, formatInstallNpmCommand } from '../src';
import { join } from 'path';
import { existsSync, remove } from 'fs-extra';
import * as assert from 'assert';
import * as mm from 'mm';
describe('command-core:npm.test.ts', () => {
  it('npm plugin', async () => {
    const nm = join(
      __dirname,
      '../node_modules/',
      '@midwayjs/cli-plugin-clean'
    );
    if (existsSync(nm)) {
      await remove(nm);
    }
    const result = [];
    const core = new CommandCore({
      commands: [],
      options: { h: true },
      provider: 'test',
      log: {
        log: (msg: string) => {
          result.push(msg);
        },
      },
      displayUsage: (commandsArray, usage, coreInstance) => {
        result.push(coreInstance.commands);
      },
    });
    core.addPlugin('npm::@midwayjs/cli-plugin-clean');
    await core.ready();
    await core.invoke();
    assert(result.find(cmd => !!cmd.clean));
  });

  it('findNpm npm default', async () => {
    const npmRes = findNpm({});
    assert(npmRes.npm);
  });

  it('findNpm npm registry', async () => {
    const npmRes = findNpm({
      npm: 'cnpm',
      registry: 'test',
    });
    assert(npmRes.npm === 'cnpm' && npmRes.registry === 'test');
  });

  it('findNpm yarn by npm_config_user_agent', async () => {
    mm(process.env, 'npm_config_user_agent', 'yarn');
    mm(process.env, 'npm_config_registry', 'test');
    const npmRes = findNpm({});
    assert(npmRes.npm === 'yarn' && npmRes.registry === 'test');
  });
  it('findNpm yarn by npm_execpath', async () => {
    mm(process.env, 'npm_execpath', 'yarn');
    mm(process.env, 'npm_config_registry', 'test');
    const npmRes = findNpm({});
    assert(npmRes.npm === 'yarn' && npmRes.registry === 'test');
  });
  it('findNpm yarn by yarn_registry', async () => {
    mm(process.env, 'yarn_registry', 'test');
    const npmRes = findNpm({});
    assert(npmRes.npm === 'yarn' && npmRes.registry === 'test');
  });
  it('findNpm registry by LANG', async () => {
    mm(process.env, 'LANG', 'zh_CN.UTF-8');
    mm(process.env, 'npm_config_registry', '');
    const npmRes = findNpm({ npm: 'npm' });
    assert(
      npmRes.npm === 'npm' &&
        npmRes.registry === 'https://registry.npmmirror.com'
    );
  });
  it('pnpm install module', async () => {
    const cmd = formatInstallNpmCommand({
      register: 'pnpm',
      moduleName: '@midwayjs/core',
      mode: ['no-save'],
    });
    assert(cmd === 'pnpm add @midwayjs/core --save-optional');
  });
  it('pnpm install project production', async () => {
    const cmd = formatInstallNpmCommand({
      register: 'pnpm',
      mode: ['production'],
    });
    assert(cmd === 'pnpm install --prod');
  });
});
