import { CommandCore, BasePlugin, filterPluginByCommand } from '../src';
import * as assert from 'assert';
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
});
