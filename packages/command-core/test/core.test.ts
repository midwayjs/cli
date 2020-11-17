import { CommandCore } from '../src';
import TestPlugin from './plugins/test.invoke';
import { PluginTest2 } from './plugins/test-not-provider.invoke';
import * as assert from 'assert';
import { join, resolve } from 'path';
import { existsSync, readFileSync, remove } from 'fs-extra';

describe('command-core', () => {
  it('stop lifecycle', async () => {
    const result: string[] = [];
    const core = new CommandCore({
      provider: 'test',
      log: {
        log: (msg: string) => {
          result.push(msg);
        },
      },
      stopLifecycle: 'invoke:one',
    });
    core.addPlugin(TestPlugin);
    core.addPlugin(PluginTest2);
    await core.ready();
    await core.invoke(['invoke']);
    assert(result && result.length === 3);
  });
  it('stop lifecycle and resume', async () => {
    const result: string[] = [];
    const core = new CommandCore({
      provider: 'test',
      log: {
        log: (msg: string) => {
          result.push(msg);
        },
      },
      stopLifecycle: 'invoke:one',
    });
    core.addPlugin(TestPlugin);
    await core.ready();
    await core.invoke(['invoke']);
    assert(result.length === 3);
    await core.resume();
    assert((result as any).length === 6);
  });
  it('user lifecycle', async () => {
    const cwd = join(__dirname, './fixtures/userLifecycle');
    const txt = join(cwd, 'test.txt');
    if (existsSync(txt)) {
      await remove(txt);
    }
    const core = new CommandCore({
      provider: 'test',
      cwd,
      options: {
        verbose: true,
      },
    });
    core.addPlugin(TestPlugin);
    await core.ready();
    await core.invoke(['invoke']);
    const testData = readFileSync(txt).toString();
    assert(testData === 'user');
  });
  it('user lifecycle error', async () => {
    const cwd = join(__dirname, './fixtures/userLifecycle-error');
    const txt = join(cwd, 'test.txt');
    if (existsSync(txt)) {
      await remove(txt);
    }
    const result = [];
    const core = new CommandCore({
      provider: 'test',
      cwd,
      log: {
        log: (...msg) => {
          result.push(...msg);
        },
      },
      options: {
        verbose: true,
      },
    });
    core.addPlugin(TestPlugin);
    await core.ready();
    await core.invoke(['invoke']);
    assert(result.join('|').indexOf('User Lifecycle Hook Error') !== -1);
  });
  it('local plugin', async () => {
    const result = [];
    const core = new CommandCore({
      provider: 'test',
      log: {
        log: (msg: string) => {
          result.push(msg);
        },
      },
      stopLifecycle: 'invoke:one',
    });
    core.addPlugin('local::' + resolve(__dirname, './plugins/test.invoke.ts'));
    await core.ready();
    await core.invoke(['invoke']);
    assert(result.length === 3);
  });
});
