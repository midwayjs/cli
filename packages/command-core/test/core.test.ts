import { CommandCore } from '../src';
import TestPlugin from './plugins/test.invoke';
import ErrorPlugin from './plugins/hook-error';
import PassingPlugin from './plugins/command-passing';
import { PluginTest2 } from './plugins/test-not-provider.invoke';
import * as assert from 'assert';
import { join } from 'path';
import { existsSync, readFileSync, remove } from 'fs-extra';

describe('command-core', () => {
  it('stop lifecycle', async () => {
    const result: string[] = [];
    let cmd;
    const core = new CommandCore({
      provider: 'test',
      log: {
        log: (msg: string) => {
          result.push(msg);
        },
      },
      point: c => {
        cmd = c;
      },
      stopLifecycle: 'invoke:one',
    });
    core.addPlugin(TestPlugin);
    core.addPlugin(PluginTest2);
    await core.ready();
    await core.invoke('invoke');
    assert(result && result.length === 3);
    const times = core.getTimeTicks();
    assert(cmd === 'invoke');
    assert(times.length === 3);
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
      service: {
        plugins: [TestPlugin],
      },
      stopLifecycle: 'invoke:one',
    });
    await core.ready();
    await core.spawn(['invoke']);
    assert(result.length === 3);
    await core.resume({});
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
    const times = core.getTimeTicks();
    assert(testData === 'user');
    assert(times.length === 7);
    assert(times[1].type === 'before:invoke:one');
    assert(times[6].type === 'after:invoke:two');
  });
  it('hook error', async () => {
    const core = new CommandCore({});
    core.addPlugin(ErrorPlugin);
    await core.ready();
    try {
      await core.invoke(['common']);
      assert(false);
    } catch (e) {
      assert(e.message.indexOf('hook123') !== -1);
    }
  });
  it('hook child command error', async () => {
    const core = new CommandCore({});
    core.addPlugin(ErrorPlugin);
    await core.ready();
    try {
      await core.invoke(['common', 'aaa']);
      assert(false);
    } catch (e) {
      assert(e.message.indexOf('hookaerror') !== -1);
    }
  });
  it('passing command', async () => {
    const core = new CommandCore({
      commands: ['a', 'b'],
    });
    core.addPlugin(PassingPlugin);
    await core.ready();
    await core.invoke();
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
    core.addPlugin(123);
    await core.ready();
    try {
      await core.invoke(['invoke']);
    } catch {
      //
    }
    assert(result.join('|').indexOf('User Lifecycle Hook Error') !== -1);
  });
  it('local plugin', async () => {
    const result = [];
    const core = new CommandCore({
      config: {
        servicePath: __dirname,
      },
      provider: 'test',
      log: {
        log: args => {
          result.push(args);
        },
      },
    });
    core.addPlugin('local::./plugins/test.invoke.ts');
    await core.ready();
    await core.invoke(['invoke']);
    assert(result.length === 6);
  });
  it('local plugin error', async () => {
    const core = new CommandCore({
      config: {
        servicePath: __dirname,
      },
      log: {
        log: () => {},
      },
      provider: 'test',
    });
    try {
      core.addPlugin('local::./plugins/test.invokexx.ts');
      assert(false);
    } catch (e) {
      assert(e.message.indexOf('load local plugi') !== -1);
    }
  });
});
