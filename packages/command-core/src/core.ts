// 内核，用于加载并按照生命周期执行插件逻辑
import { resolve } from 'path';
import { exec } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import Spin from 'light-spinner';

import {
  IOptions,
  ICommandCore,
  ICoreInstance,
  ICommands,
  IHooks,
} from './interface/commandCore';
import { IPluginInstance, ICommandInstance } from './interface/plugin';
import { IProviderInstance } from './interface/provider';
import GetMap from './errorMap';
import { loadNpm } from './npm';

// npm:providerName:pkgName
const RegProviderNpm = /^npm:([\w]*):(.*)$/i;
// local:providerName:pkgPath
const RegProviderLocal = /^local:([\w]*):(.*)$/i;

export class CommandCore implements ICommandCore {
  options: IOptions;
  private instances: IPluginInstance[] = []; // 插件实例列表
  private commands: ICommands = {}; // 命令列表
  private hooks: IHooks = {}; // 命令生命周期
  private coreInstance: ICoreInstance; // 内核实例，用以传递给插件
  private providers: { [providerName: string]: IProviderInstance } = {};
  private npmPlugin: string[] = []; // npm类型插件
  private execId: number = Math.ceil(Math.random() * 1000); // 当前执行ID，用以在多次执行时进行区分
  private userLifecycle: { [lifecycle: string]: string } = {}; // 用户自定义生命周期钩子，便于项目级扩展
  private cwd: string;
  private preDebugTime: number;
  private stopLifecycles: string[] = [];
  private loadNpm = loadNpm.bind(null, this);

  store = new Map();

  constructor(options: IOptions) {
    this.options = options;
    this.cwd = this.options.cwd || process.cwd();
    if (!this.options.options) {
      this.options.options = {};
    }
    if (!this.options.config) {
      this.options.config = {};
    }
    if (!this.options.config.servicePath) {
      this.options.config.servicePath = this.cwd;
    }
    this.loadNpm = loadNpm.bind(null, this);
    this.coreInstance = this.getCoreInstance();
    if (!this.options.disableAutoLoad) {
      this.autoLoadPlugins();
    }
  }

  // 添加插件
  public addPlugin(Plugin: any) {
    if (typeof Plugin === 'object') {
      return Object.keys(Plugin).forEach(key => {
        this.addPlugin(Plugin[key]);
      });
    }

    const provider =
      this.options.service?.provider?.name || this.options.provider;
    this.debug('Current Provider', provider);
    const coreInstance: ICoreInstance = this.coreInstance;
    let pluginProvider = '';
    // 支持加载npm 或 本地插件（绝对地址）
    if (typeof Plugin === 'string') {
      if (RegProviderNpm.test(Plugin)) {
        const npmProviderMatch: any = RegProviderNpm.exec(Plugin);
        pluginProvider = npmProviderMatch[1];
        if (pluginProvider && pluginProvider !== provider) {
          return;
        }
        this.npmPlugin.push(npmProviderMatch[2]);
      } else if (RegProviderLocal.test(Plugin)) {
        const localProviderMatch: any = RegProviderLocal.exec(Plugin);
        pluginProvider = localProviderMatch[1];
        if (pluginProvider && pluginProvider !== provider) {
          return;
        }
        this.loadLocalPlugin(localProviderMatch[2]);
      } else {
        this.error('pluginType', Plugin);
      }
      return;
    }

    // 非class不加载
    if (typeof Plugin !== 'function') {
      return;
    }

    const instance = new Plugin(coreInstance, this.options.options);

    if (instance.provider) {
      if (typeof instance.provider === 'string') {
        pluginProvider = instance.provider;
      } else if (Array.isArray(instance.provider)) {
        // provider is list
        if (instance.provider.indexOf(provider) === -1) {
          this.debug(
            'Code skip load plugin',
            Plugin?.name,
            '[provide not match]'
          );
          return;
        }
      } else {
        pluginProvider = instance.provider.constructor.getProviderName();
      }
    }

    // 不支持的provider
    if (pluginProvider && pluginProvider !== provider) {
      this.debug('Code skip load plugin', Plugin?.name, '[provide not match]');
      return;
    }

    // 避免多次加载
    if (this.instances.length) {
      for (const plugin of this.instances) {
        if (plugin instanceof Plugin) {
          return;
        }
      }
    }
    this.debug('Core Load plugin', Plugin.name);
    this.loadCommands(instance, this.commands, instance.commands);
    this.loadHooks(instance.hooks);
    this.instances.push(instance);
  }

  /*
    commandsArray 为多级命令，如 [invoke, local] 则执行 invoke的二级子命令 local
    allowEntryPoints 为是否可以调用 entryPoints
    */
  public async invoke(
    commandsArray?: string | string[],
    allowEntryPoints?: boolean,
    options?: any
  ) {
    if (commandsArray == null) {
      commandsArray = this.options.commands;
    }
    if (!Array.isArray(commandsArray)) {
      commandsArray = [].concat(commandsArray || []);
    }
    if (options) {
      Object.assign(this.options.options, options);
    }
    const displayHelp = this.options.options.h || this.options.options.help;
    if (!commandsArray.length && displayHelp) {
      return this.displayHelp();
    }
    const commandInfo = this.getCommand(commandsArray, allowEntryPoints);
    const lifecycleEvents = this.loadLifecycle(
      commandInfo.commandName,
      commandInfo.command.lifecycleEvents,
      commandInfo.parentCommandList
    );

    if (this.options.point) {
      this.options.point('invoke', commandsArray, commandInfo, this);
    }

    // 展示帮助
    if (displayHelp) {
      return this.displayHelp(
        commandsArray,
        commandInfo.usage,
        commandInfo.command
      );
    }
    await this.execLiftcycle(lifecycleEvents);
  }

  private async execLiftcycle(lifecycleEvents) {
    for (const lifecycle of lifecycleEvents) {
      if (this.userLifecycle && this.userLifecycle[lifecycle]) {
        const userCmd = this.userLifecycle[lifecycle];
        this.debug('User Lifecycle', lifecycle);
        const spin = new Spin({ text: `Executing: ${userCmd}` });
        spin.start();
        try {
          await this.execCommand(userCmd);
        } catch (e) {
          spin.stop();
          this.debug('User Lifecycle Hook Error', userCmd, e);
          throw e;
        }
        spin.stop();
      }
      const hooks = this.hooks[lifecycle] || [];
      this.debug('Core Lifecycle', lifecycle, hooks.length);
      for (const hook of hooks) {
        try {
          await hook();
        } catch (e) {
          this.debug('Core Lifecycle Hook Error', e);
          throw e;
        }
      }
    }
  }

  // resume stop licycle execute
  public async resume(options?) {
    if (options) {
      Object.assign(this.options.options, options);
    }
    await this.execLiftcycle(this.stopLifecycles);
  }

  // spawn('aliyun:invoke')
  public async spawn(commandsArray: string | string[], options?: any) {
    let commands: string[] = [];
    if (typeof commandsArray === 'string') {
      commands = commandsArray.split(':');
    } else {
      commands = commandsArray;
    }
    await this.invoke(commands, true, options);
  }

  public getCommands() {
    return this.commands;
  }

  public async ready() {
    await this.asyncInit();
    await this.loadNpmPlugins();
    await this.loadUserLifecycleExtends();
  }

  autoLoadPlugins() {
    if (this.options.service && this.options.service.plugins) {
      this.options.service.plugins.forEach(plugin => {
        this.debug('Auto Plugin', plugin);
        this.addPlugin(plugin);
      });
    }
  }

  // 获取核心instance
  private getCoreInstance(): ICoreInstance {
    const { provider, service, config, extensions, commands } = this.options;
    const serviceData: any = service || {};
    if (!serviceData.provider) {
      serviceData.provider = { name: provider };
    }
    if (!serviceData.service) {
      serviceData.service = service;
    }
    if (provider) {
      serviceData.provider.name = provider;
    }
    return {
      ...(extensions || {}),
      classes: {
        Error,
      },
      store: this.store,
      cli: this.getLog(),
      config: config || {},
      getProvider: this.getProvider.bind(this),
      invoke: this.invoke.bind(this),
      spawn: this.spawn.bind(this),
      debug: this.debug.bind(this),
      processedInput: {
        options: {},
        commands: commands || [],
      },
      coreOptions: this.options,
      cwd: this.cwd,
      pluginManager: this,
      setProvider: this.setProvider.bind(this),
      service: serviceData,
      addPlugin: this.addPlugin.bind(this),
    };
  }

  // 设置 provider
  private setProvider(
    providerName: string,
    providerInstance: IProviderInstance
  ) {
    this.providers[providerName] = providerInstance;
  }

  // 获取 provider
  private getProvider(providerName: string): IProviderInstance {
    return this.providers[providerName];
  }

  // 加载命令,支持子命令
  private loadCommands(
    instance,
    commandsMap: any,
    commands: any,
    parentCommandList?: string[]
  ) {
    if (!commands) {
      return;
    }
    Object.keys(commands).forEach((command: string) => {
      const commandInstance: ICommandInstance = commands[command];

      if (!commandsMap[command]) {
        commandsMap[command] = {
          usage: '',
          type: commandInstance.type || 'command',
          lifecycleEvents: [],
          rank: -1,
          options: {},
          passingCommand: commandInstance.passingCommand,
          origin: [],
          alias: commandInstance.alias,
          commands: {},
        };
      }

      const currentCommand = commandsMap[command];
      commandsMap[command].origin.push(commandInstance);

      const currentRank = commandInstance.rank || 0;

      // 如果当前插件的rank比当前命令的rank大，则会覆盖
      if (currentRank > currentCommand.rank) {
        currentCommand.rank = currentRank;
        currentCommand.lifecycleEvents = commandInstance.lifecycleEvents;
        if (commandInstance.usage) {
          currentCommand.usage = commandInstance.usage;
        }
        commandsMap[command].alias = commandInstance.alias || '';
      }

      // 加载子命令
      if (commandInstance.commands) {
        this.loadCommands(
          instance,
          commandsMap[command].commands,
          commandInstance.commands,
          (parentCommandList || []).concat(command)
        );
      }
      // 合并 options
      currentCommand.options = Object.assign(
        currentCommand.options,
        commandInstance.options
      );
    });
  }

  // 加载hooks
  private loadHooks(hooks: any) {
    if (!hooks) {
      return;
    }
    for (const hookName in hooks) {
      if (!this.hooks[hookName]) {
        this.hooks[hookName] = [];
      }
      this.hooks[hookName].push(hooks[hookName]);
    }
  }

  private loadLifecycle(
    command: string,
    lifecycleEvents: string[] | undefined,
    parentCommandList?: string[]
  ) {
    const allLifecycles: string[] = [];
    let isStop = false;
    const { stopLifecycle } = this.options;
    const parentCommand =
      parentCommandList && parentCommandList.length
        ? `${parentCommandList.join(':')}:`
        : '';
    if (lifecycleEvents) {
      for (const life of lifecycleEvents) {
        const liftCycles = isStop ? this.stopLifecycles : allLifecycles;
        const tmpLife = `${parentCommand}${command}:${life}`;
        liftCycles.push(`before:${tmpLife}`);
        liftCycles.push(tmpLife);
        liftCycles.push(`after:${tmpLife}`);
        if (stopLifecycle === tmpLife) {
          isStop = true;
        }
      }
    }
    return allLifecycles;
  }

  private getCommand(commandsArray: string[], allowEntryPoints?: boolean): any {
    let command: string | undefined = '';
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let cmdObj: any = this;
    const commandPath: string[] = [];
    const parentCommandList: string[] = [];
    const usage = {};
    // command 透传
    for (command of commandsArray) {
      if (commandPath.length) {
        parentCommandList.push(commandPath[commandPath.length - 1]);
      }

      const cmdInfo = cmdObj?.commands?.[command];
      if (!cmdInfo) {
        // support command alias alias
        const aliasCommand = Object.keys(cmdObj?.commands || {}).find(
          commandName => {
            return cmdObj.commands[commandName].alias === command;
          }
        );

        if (!aliasCommand) {
          this.error('commandNotFound', { command, commandPath });
        } else {
          command = aliasCommand;
        }
      }
      commandPath.push(command);
      cmdObj = cmdObj.commands[command];
      if (cmdObj) {
        if (cmdObj.options) {
          this.commandOptions(cmdObj.options, usage);
        }

        if (cmdObj?.passingCommand) {
          break;
        }
      }
    }
    if (!cmdObj) {
      this.error('commandNotFound', { command, commandPath });
    }
    if (cmdObj?.type === 'entrypoint' && !allowEntryPoints) {
      this.error('commandIsEntrypoint', { command, commandPath });
    }

    return {
      commandName: command,
      command: cmdObj,
      usage,
      parentCommandList,
    };
  }

  // 加载本地插件
  private loadLocalPlugin(localPath) {
    try {
      if (
        this.options.config &&
        this.options.config.servicePath &&
        /^\./.test(localPath)
      ) {
        localPath = resolve(this.options.config.servicePath, localPath);
      }
      this.debug('Core Local Plugin', localPath);
      const plugin = require(localPath);
      this.addPlugin(plugin);
    } catch (e) {
      this.error('localPlugin', { path: localPath, err: e });
    }
  }

  // 加载npm包插件
  private async loadNpmPlugins() {
    for (const npmPath of this.npmPlugin) {
      await this.loadNpm(npmPath, this.options.options.npm || this.options.npm);
    }
  }

  // 插件的异步初始化
  private async asyncInit() {
    for (const instance of this.instances) {
      if (instance.asyncInit) {
        await instance.asyncInit();
      }
    }
  }

  // 获取用户的生命周期扩展
  private async loadUserLifecycleExtends() {
    const pkgJsonFile = resolve(this.cwd, 'package.json');
    if (!existsSync(pkgJsonFile)) {
      return;
    }
    try {
      const pkgJson = JSON.parse(readFileSync(pkgJsonFile).toString());
      if (
        pkgJson &&
        pkgJson['midway-integration'] &&
        pkgJson['midway-integration'].lifecycle
      ) {
        this.userLifecycle = pkgJson['midway-integration'].lifecycle;
      }
    } catch (e) {
      return;
    }
  }

  private commandOptions(commandOptions, usage): any {
    for (const option in commandOptions) {
      const optionInfo = commandOptions[option];
      usage[option] = optionInfo;
      if (optionInfo?.shortcut) {
        if (this.options.options[optionInfo.shortcut]) {
          this.options.options[option] =
            this.options.options[optionInfo.shortcut];
        }
      }
      this.coreInstance.processedInput.options[option] =
        this.options.options[option];
    }
  }

  private displayHelp(commandsArray?, usage?, commandInfo?) {
    if (this.options.displayUsage) {
      this.options.displayUsage(
        commandsArray || [],
        usage || {},
        this,
        commandInfo
      );
    }
  }

  private getLog() {
    return this.options.log || console;
  }

  error<T>(type: string, info?: T) {
    const errObj: {
      info?: T;
      message: string;
    } = GetMap(type, info);

    const { cli } = this.coreInstance;
    if (cli && cli.error) {
      cli.error(errObj);
    } else {
      throw new Error(errObj.message);
    }
  }

  debug(...args) {
    const verbose =
      this.options.options.V ||
      this.options.options.verbose ||
      process.env.MIDWAY_FAAS_VERBOSE;
    if (!verbose) {
      return;
    }

    const now = Date.now();
    if (!this.preDebugTime) {
      this.preDebugTime = now;
    }
    const { type, path, line } = this.getStackTrace();
    let stack = '';
    if (type) {
      stack = `(${type}:${path}:${line})`;
    }
    const diffTime = Number((now - this.preDebugTime) / 1000).toFixed(2);
    this.preDebugTime = now;
    this.getLog().log(
      '[Verbose]',
      this.execId,
      `+${diffTime}s`,
      ...args,
      stack
    );
  }

  getStackTrace() {
    if (!Error.captureStackTrace) {
      return {};
    }
    const obj: any = {};
    Error.captureStackTrace(obj, this.getStackTrace);
    if (!obj.stack || !obj.stack.split) {
      return {};
    }
    const stackStr = obj.stack.split('\n');
    if (!stackStr || !stackStr[2]) {
      return {};
    }
    const matchReg = /(?:-plugin-|\/command-core)(\w+)\/(.*?):(\d+):\d+/;
    if (!matchReg.test(stackStr[2])) {
      return {};
    }
    const matchResult = matchReg.exec(stackStr[2]);
    return {
      type: matchResult[1],
      path: matchResult[2],
      line: matchResult[3],
    };
  }

  async execCommand(command: string) {
    return new Promise<void>((resolve, reject) => {
      const execProcess = exec(
        command,
        {
          cwd: this.cwd,
        },
        error => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        }
      );
      execProcess.stdout.on('data', data => {
        this.getLog().log(data);
      });
    });
  }
}
