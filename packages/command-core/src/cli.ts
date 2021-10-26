import * as minimist from 'minimist';
import { join } from 'path';
import { commandLineUsage } from './utils/commandLineUsage';
import { CommandCore } from './core';
import { existsSync, readFileSync } from 'fs';

export class CoreBaseCLI {
  argv: any;
  providerName: string;
  core: any;
  spec: any;
  specFile: any;
  commands: string[];
  cwd = process.cwd();

  constructor(argv) {
    if (Array.isArray(argv)) {
      this.argv = minimist(argv.slice(2));
    } else {
      this.argv = argv;
    }
    this.commands = [].concat(this.argv._);
    this.initCore();
  }

  initCore() {
    this.core = new CommandCore({
      commands: this.commands,
      options: this.argv,
      log: this.loadLog(),
      displayUsage: this.displayUsage.bind(this),
      extensions: this.loadExtensions(),
      ...this.coverCoreOptions(),
    });
  }

  async loadPlugins() {
    await this.loadCorePlugin();
    await this.loadDefaultPlugin();
    await this.loadPlatformPlugin();
  }

  loadCorePlugin() {}

  // 加载默认插件
  loadDefaultPlugin() {
    const { cwd } = this;
    const packageJsonFile = join(cwd, 'package.json');
    if (!existsSync(packageJsonFile)) {
      this.core.debug('no user package.json', packageJsonFile);
      return;
    }
    const packageJson = JSON.parse(readFileSync(packageJsonFile).toString());
    const deps = packageJson?.['midway-cli']?.plugins || [];
    this.core.debug('mw plugin', deps);
    const currentNodeModules = join(cwd, 'node_modules');
    deps.forEach(dep => {
      const npmPath = join(currentNodeModules, dep);
      if (!existsSync(npmPath)) {
        throw new Error(
          `Auto load mw plugin error: '${dep}' not install in '${currentNodeModules}'`
        );
      }
      try {
        const mod = require(npmPath);
        this.core.addPlugin(mod);
      } catch (e) {
        e.message = `Auto load mw plugin error: ${e.message}`;
        throw e;
      }
    });
  }

  // 加载平台方插件
  loadPlatformPlugin() {}

  // 加载cli拓展
  loadExtensions() {
    return {};
  }

  // 覆盖默认的 core options
  coverCoreOptions() {
    return {};
  }

  // 加载命令行输出及报错
  loadLog() {
    return { ...console, error: this.error };
  }

  getUsageInfo(commandsArray: any[], usage, coreInstance, commandInfo?) {
    let commandList: any = {};
    if (commandsArray && commandsArray.length) {
      commandList = {
        header:
          commandsArray.join(' ') +
          (commandInfo?.alias ? `/${commandInfo.alias}` : ''),
        content: commandInfo?.usage,
        optionList: usage
          ? Object.keys(usage).map(name => {
              const usageInfo = usage[name] || {};
              return {
                name,
                description: usageInfo.usage,
                alias: usageInfo.shortcut,
              };
            })
          : [],
        childCommands: commandInfo?.commands
          ? Object.keys(commandInfo?.commands).map(command => {
              const childCommandInfo = commandInfo?.commands[command];
              return this.getUsageInfo(
                [command],
                childCommandInfo.options,
                coreInstance,
                childCommandInfo
              );
            })
          : null,
      };
    } else {
      commandList = [];
      coreInstance.instances.forEach(plugin => {
        if (!plugin.commands) {
          return;
        }
        Object.keys(plugin.commands).forEach(command => {
          const commandInfo = plugin.commands[command];
          if (!commandInfo || !commandInfo.lifecycleEvents) {
            return;
          }
          commandList.push({
            header: command,
            content: commandInfo.usage,
            optionList: Object.keys(commandInfo.options || {}).map(name => {
              const usageInfo = commandInfo.options[name] || {};
              return {
                name,
                description: usageInfo.usage,
                alias: usageInfo.shortcut,
              };
            }),
            childCommands: commandInfo.commands
              ? Object.keys(commandInfo.commands).map(command => {
                  const childCommandInfo = commandInfo.commands[command];
                  return this.getUsageInfo(
                    [command],
                    childCommandInfo.options,
                    coreInstance,
                    childCommandInfo
                  );
                })
              : null,
          });
        });
      });
    }
    return commandList;
  }

  // 展示帮助信息
  displayUsage(commandsArray, usage, coreInstance, commandInfo?) {
    const log = this.loadLog();
    const commandList = this.getUsageInfo(
      commandsArray,
      usage,
      coreInstance,
      commandInfo
    );
    log.log(commandLineUsage(commandList));
  }

  error(err) {
    console.error((err && err.message) || err);
    process.exit(1);
  }

  loadRelativePlugin(dirPath, path) {
    try {
      const localPlugin = require(join(this.cwd, dirPath, path));
      this.core.addPlugin(localPlugin);
      return true;
    } catch (e) {
      return false;
    }
  }

  async start() {
    await this.loadPlugins();
    await this.core.ready();
    await this.core.invoke();
  }
}
