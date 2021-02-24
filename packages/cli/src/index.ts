import {
  CoreBaseCLI,
  filterPluginByCommand,
  getPluginClass,
} from '@midwayjs/command-core';
import { execSync } from 'child_process';
import { PluginList } from './plugins';

export * from './utils';
const FaaSPlugin = 'FaaSPlugin';
const enquirer = require('enquirer');

export class CLI extends CoreBaseCLI {
  async loadDefaultPlugin() {
    const command = this.commands && this.commands[0];
    // // version not load plugin
    if (this.argv.v || this.argv.version) {
      return;
    }
    await super.loadDefaultPlugin();
    let needLoad = PluginList;
    const req = this.argv.require || require;
    if (!this.argv.h && command) {
      needLoad = filterPluginByCommand(PluginList, {
        command,
        cwd: this.core.cwd,
        load: name => req(name),
      });
    }
    if (this.argv.isFaaS) {
      delete this.argv.isFaaS;
      const isLoadFaaS = needLoad.find(mod => mod.name === FaaSPlugin);
      if (!isLoadFaaS) {
        const faasMod = PluginList.find(mod => mod.name === FaaSPlugin);
        if (faasMod) {
          needLoad.push(faasMod);
        }
      }
    }
    this.debug('Plugin load list', needLoad);
    const allPluginClass = await getPluginClass(needLoad, {
      cwd: this.core.cwd,
      load: name => require(name),
      npm: this.argv.npm,
    });
    allPluginClass.forEach(pluginClass => {
      this.core.addPlugin(pluginClass);
    });
  }

  // cli 扩展
  loadExtensions() {
    return {
      debug: this.debug.bind(this),
      enquirer,
    };
  }

  error(err) {
    if (err && err.message) {
      console.log(err.message);
      throw err;
    } else {
      console.log(err);
      throw new Error(err);
    }
  }

  async loadPlugins() {
    this.debug('command & options', this.argv);
    await super.loadPlugins();
    await this.loadDefaultOptions();
  }

  async loadDefaultOptions() {
    if (this.commands.length) {
      return;
    }

    if (this.argv.v || this.argv.version) {
      this.displayVersion();
    } else {
      // 默认没有command的时候展示帮助
      this.argv.h = true;
    }
  }

  debug(...args) {
    if (!this.argv.V && !this.argv.verbose && !process.env.FAAS_CLI_VERBOSE) {
      return;
    }
    const log = this.loadLog();
    log.log('[Verbose] ', ...args);
  }

  displayVersion() {
    const log = this.loadLog();
    try {
      const nodeVersion = execSync('node -v').toString().replace('\n', '');
      log.log('Node.js'.padEnd(20) + nodeVersion);
    } catch {
      //
    }

    try {
      // midway-faas version
      const cliVersion = require('../package.json').version;
      log.log('@midwayjs/cli'.padEnd(20) + `v${cliVersion}`);
    } catch {
      //
    }
  }

  displayUsage(commandsArray, usage, coreInstance) {
    this.displayVersion();
    super.displayUsage(commandsArray, usage, coreInstance);
  }
}
