import { CoreBaseCLI } from '../src';
import * as assert from 'assert';
import { resolve, relative } from 'path';
import NoCommand from './plugins/no-command';
import TestPlugin from './plugins/no-provider';
import { ensureDir, writeFileSync, remove, existsSync } from 'fs-extra';

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
    const logStr = logList.join('\n');
    assert(logStr.includes('common command'));
    assert(logStr.includes('x xChild'));
    assert(logStr.includes('--name'));
    assert(logStr.includes('xChild name option'));
  });
  it('cli auto load plugin success', async () => {
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
    const cli = new TestCli(['', '', '-h', '-V']);
    const baseDir = resolve(__dirname, './fixtures/auto-plugin');
    await ensureDir(baseDir);
    const pluginName = 'test' + Math.ceil(Date.now());
    const pkjJson = resolve(baseDir, 'package.json');
    writeFileSync(
      pkjJson,
      JSON.stringify({
        'midway-cli': {
          plugins: [pluginName],
        },
      })
    );
    const nm = resolve(baseDir, 'node_modules/' + pluginName);
    await ensureDir(nm);
    writeFileSync(
      resolve(nm, 'index.js'),
      `class Test {
        constructor() {
          this.commands = { 
            ${pluginName}: {
              lifecycleEvents: ['main'],
              options: {
                mwtest123: {
                  usage: 'xxx'
                }
              }
            }
          };
        }
      };
      exports.Test = Test;`
    );
    cli.cwd = baseDir;
    await cli.start();
    await remove(nm);
    await remove(pkjJson);
    const logContext = logList.join('\n');
    assert(logContext.indexOf(pluginName) !== -1);
    assert(logContext.indexOf('mwtest123') !== -1);
  });
  it('cli auto load plugin error', async () => {
    const cli = new CoreBaseCLI(['', '', '-h']);
    const baseDir = resolve(__dirname, './fixtures/auto-plugin');
    await ensureDir(baseDir);
    const pluginName = 'test' + Math.ceil(Date.now());
    const pkjJson = resolve(baseDir, 'package.json');
    writeFileSync(
      pkjJson,
      JSON.stringify({
        'midway-cli': {
          plugins: [pluginName],
        },
      })
    );
    const nm = resolve(baseDir, 'node_modules/' + pluginName);
    await ensureDir(nm);
    writeFileSync(
      resolve(nm, 'index.js'),
      "throw new Error('plugin error 123');"
    );
    cli.cwd = baseDir;
    try {
      await cli.start();
      assert(false);
    } catch (e) {
      assert(e.message.indexOf('Auto load mw plugin error') !== -1);
      assert(e.message.indexOf('plugin error 123') !== -1);
    }
    await remove(nm);
    await remove(pkjJson);
  });
  it('cli auto load plugin not exists', async () => {
    const cli = new CoreBaseCLI(['', '', '-h']);
    const baseDir = resolve(__dirname, './fixtures/auto-plugin');
    await ensureDir(baseDir);
    const pkjJson = resolve(baseDir, 'package.json');
    writeFileSync(
      pkjJson,
      JSON.stringify({
        'midway-cli': {
          plugins: ['test'],
        },
      })
    );
    cli.cwd = baseDir;
    try {
      await cli.start();
      assert(false);
    } catch (e) {
      assert(/'test' not install/.test(e.message));
    }
    await remove(pkjJson);
  });
  it('cli auto load plugin no pacakge.json', async () => {
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
    const cli = new TestCli(['', '', '-h', '-V']);
    const baseDir = resolve(__dirname, './fixtures/auto-plugin');
    await ensureDir(baseDir);
    const pkjJson = resolve(baseDir, 'package.json');
    if (existsSync(pkjJson)) {
      await remove(pkjJson);
    }
    cli.cwd = baseDir;
    await cli.start();
    const logContext = logList.join('\n');
    assert(logContext.indexOf('no user package.json') !== -1);
  });
  it('cli auto load plugin no auto plugins', async () => {
    const cli = new CoreBaseCLI(['', '', '-h']);
    const baseDir = resolve(__dirname, './fixtures/auto-plugin');
    await ensureDir(baseDir);
    const pkjJson = resolve(baseDir, 'package.json');
    writeFileSync(pkjJson, JSON.stringify({}));
    cli.cwd = baseDir;
    await cli.start();
    await remove(pkjJson);
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
    assert(logList.join('\n').indexOf('noLifecycleEvents') !== -1);
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
    assert(logList.join('\n').indexOf('noLifecycleEvents') === -1);
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
