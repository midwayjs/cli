import { CoreBaseCLI } from '../src';
import * as assert from 'assert';
import { resolve, relative } from 'path';
import NoCommand from './plugins/no-command';
import TestPlugin from './plugins/no-provider';
describe('command-core / cli.test.ts', () => {
  it('cli no command err', async () => {
    let err;
    class TestCli extends CoreBaseCLI {
      error(e) {
        err = e;
      }
    }
    try {
      const cli = new TestCli(['', '', 'nocommand']);
      await cli.start();
    } catch {
      //
    }
    assert(err.info.command === 'nocommand');
    assert(err.message === 'command nocommand not found');
  });
  it('cli help', async () => {
    const logList = [];
    class TestCli extends CoreBaseCLI {
      async loadPlatformPlugin() {
        this.core.addPlugin(NoCommand);
        this.core.addPlugin(TestPlugin);
      }
      loadLog() {
        const log = super.loadLog();
        log.log = (...args) => {
          logList.push(...args);
        };
        return log;
      }
    }
    const cli = new TestCli(['', '', '-h']);
    await cli.start();
    assert(logList.join('\n').indexOf('common command') !== -1);
  });
  it('cli argv', async () => {
    const logList = [];
    class TestCli extends CoreBaseCLI {
      async loadPlatformPlugin() {
        this.core.addPlugin(TestPlugin);
      }
      loadLog() {
        const log = super.loadLog();
        log.log = (...args) => {
          logList.push(...args);
        };
        return log;
      }
    }
    const cli = new TestCli({ _: [], h: true });
    await cli.start();
    assert(logList.join('\n').indexOf('common command') !== -1);
  });
  it('cli load relative plugin', async () => {
    const logList = [];
    class TestCli extends CoreBaseCLI {
      loadLog() {
        const log = super.loadLog();
        log.log = (...args) => {
          logList.push(...args);
        };
        return log;
      }
    }
    const cli = new TestCli({ _: ['noLifecycleEvents'], h: true });
    cli.loadRelativePlugin(
      relative(process.cwd(), resolve(__dirname, './plugins')),
      'no-provider.ts'
    );
    await cli.start();
    assert(logList.join('\n').indexOf('NoLifecycleEvents') !== -1);
  });
  it('cli load relative plugin error', async () => {
    const logList = [];
    class TestCli extends CoreBaseCLI {
      loadLog() {
        const log = super.loadLog();
        log.log = (...args) => {
          logList.push(...args);
        };
        return log;
      }
    }
    const cli = new TestCli({ _: [], h: true });
    cli.loadRelativePlugin('./', 'no-provider.ts');
    await cli.start();
    assert(logList.join('\n').indexOf('NoLifecycleEvents') === -1);
  });
  it('cli verbose', async () => {
    const logList = [];
    class TestCli extends CoreBaseCLI {
      loadLog() {
        const log = super.loadLog();
        log.log = (...args) => {
          logList.push(...args);
        };
        return log;
      }
    }
    const cli = new TestCli({ _: ['common'], h: true, V: true });
    cli.loadRelativePlugin(
      relative(process.cwd(), resolve(__dirname, './plugins')),
      'no-provider.ts'
    );
    await cli.start();
    assert(logList.join('\n').indexOf('[Verbose]') !== -1);
  });

  it('cli error', async () => {
    const originExit = process.exit;
    let exitCode;
    process.exit = (code => {
      exitCode = code;
    }) as any;
    class TestCli extends CoreBaseCLI {
      async loadPlatformPlugin() {
        this.core.addPlugin(TestPlugin);
      }
    }
    try {
      const cli = new TestCli({ _: ['common'] });
      await cli.start();
    } catch {
      //
    }
    process.exit = originExit;
    assert(exitCode === 1);
  });
});
