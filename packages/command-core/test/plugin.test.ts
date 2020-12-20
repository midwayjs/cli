import {
  CommandCore,
  BasePlugin,
  filterPluginByCommand,
  getPluginClass,
} from '../src';
import * as assert from 'assert';
import { join } from 'path';
import { ensureFileSync, existsSync, remove } from 'fs-extra';
describe('command-core:plugin.test.ts', () => {
  it('base plugin', async () => {
    class TestPlugin extends BasePlugin {
      commands = {
        test: {
          lifecycleEvents: ['a', 'b'],
        },
      };

      hooks = {
        'before:test:a': async () => {
          this.setGlobalDependencies('@midwayjs/faas');
          this.setGlobalResolutions('@midwayjs/cli', '1.0.0');
        },
        'test:a': async () => {
          this.setStore('a', 123);
          this.setStore('globala', 456, true);
        },
        'after:test:a': async () => {
          this.setGlobalDependencies('@midwayjs/core', '1.0.0');
        },
        'before:test:b': async () => {
          this.core.cli.log(this.core.service.globalDependencies);
        },
        'test:b': async () => {
          const data = [
            this.getStore('a'),
            this.getStore('a', 'global'),
            this.getStore('globala'),
            this.getStore('globala', 'global'),
          ];
          this.core.cli.log(data);
          this.core.cli.log(this.core.service.globalResolutions);
        },
      };
    }
    const result = [];
    const core = new CommandCore({
      commands: ['test'],
      log: {
        log: msg => {
          result.push(msg);
        },
      },
    });
    core.addPlugin(TestPlugin);
    await core.ready();
    await core.invoke();
    assert(result[0]['@midwayjs/faas'] === '*');
    assert(result[0]['@midwayjs/core'] === '1.0.0');
    assert(result[1][0] === 123);
    assert(result[1][1] === undefined);
    assert(result[1][2] === undefined);
    assert(result[1][3] === 456);
    assert(result[2]['@midwayjs/cli'] === '1.0.0');
  });
  it('filterPluginByCommand', async () => {
    const result = filterPluginByCommand(
      [
        'notSupport',
        {},
        {
          mod: 'plugin1',
          command: 'test',
        },
        {
          mod: 'plugin2',
          command: 'lalala',
        },
        {
          mod: 'plugin3',
          command: ['test', 'lalala'],
        },
        {
          mod: 'plugin4',
        },
        {
          mod: 'plugin5',
          platform: 'a',
        },
        {
          mod: 'plugin6',
          platform: 'a',
        },
        {
          mod: 'plugin7',
          platform: 'a',
        },
        {
          mod: 'plugin8',
          platform: 'a',
        },
        {
          mod: 'plugin9',
          platform: 'aaaa',
        },
        {
          mod: 'plugin10',
          command: ['lalala'],
        },
      ],
      {
        command: 'test',
        platform: 'a',
        load: pluginConfigPath => {
          if (pluginConfigPath === 'plugin3/plugin.json') {
            return {
              match: {
                file: 'plugin/plugin3.json',
              },
            };
          }
          if (pluginConfigPath === 'plugin5/plugin.json') {
            return {
              match: {
                command: ['lalala'],
              },
            };
          }
          if (pluginConfigPath === 'plugin6/plugin.json') {
            return {
              match: {
                command: 'lalala',
              },
            };
          }
          if (pluginConfigPath === 'plugin7/plugin.json') {
            return {
              match: {
                command: ['test', 'lalala'],
              },
            };
          }
          if (pluginConfigPath === 'plugin8/plugin.json') {
            return {
              match: {
                command: 'test',
              },
            };
          }
        },
      }
    );
    assert(result.find(plugin => plugin.mod === 'plugin1'));
    assert(result.find(plugin => plugin.mod === 'plugin4'));
    assert(result.find(plugin => plugin.mod === 'plugin7'));
    assert(result.find(plugin => plugin.mod === 'plugin8'));

    assert(!result.find(plugin => plugin.mod === 'plugin2'));
    assert(!result.find(plugin => plugin.mod === 'plugin3'));
    assert(!result.find(plugin => plugin.mod === 'plugin5'));
    assert(!result.find(plugin => plugin.mod === 'plugin6'));
    assert(!result.find(plugin => plugin.mod === 'plugin10'));
  });

  it('getPluginClass', async () => {
    let i = 0;
    const cwd = join(__dirname, './fixtures/plugin-test');
    const nm = join(cwd, 'node_modules');
    if (existsSync(nm)) {
      await remove(nm);
    }
    const existsFile = join(nm, 'exists/index.js');
    if (!existsSync(existsFile)) {
      ensureFileSync(existsFile);
    }
    const list = await getPluginClass(
      [
        { mod: 'plugin1', name: 'test' },
        { mod: 'plugin1', name: 'test2' },
        { mod: 'plugin2' },
        { mod: 'debug' },
        { mod: 'not-npm-module' },
        { mod: 'exists' },
        { mod: 'not exists' },
      ],
      {
        cwd,
        load: name => {
          if (name === 'plugin1') {
            return {
              test: {},
            };
          } else if (name === 'plugin2') {
            return {};
          } else if (name === 'debug') {
            if (i === 0) {
              i++;
              throw new Error('xxx');
            } else {
              return {};
            }
          } else if (name === 'exists') {
            throw new Error('xxx');
          } else if (name === 'not-npm-module') {
            throw new Error('xxx');
          }
          return;
        },
      }
    );
    assert(list.length);
  });
});
