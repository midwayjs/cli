import {
  IPluginInstance,
  IPluginHooks,
  IPluginCommands,
} from './interface/plugin';
import { ICoreInstance } from './interface/commandCore';
import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import Spin from 'light-spinner';
import { installNpm } from './npm';
export class BasePlugin implements IPluginInstance {
  public core: ICoreInstance;
  public options: any;
  public commands: IPluginCommands;
  public hooks: IPluginHooks;
  private name: string = this.getName();

  constructor(core: ICoreInstance, options: any) {
    this.core = core;
    this.options = options;
    this.commands = {};
    this.hooks = {};
  }

  public getName() {
    return this.constructor.name;
  }

  public setStore(key: string, value: any, isGlobalScope?: boolean) {
    const scope = isGlobalScope ? 'global' : this.name;
    this.core.store.set(`${scope}:${key}`, value);
  }

  public getStore(key: string, scope?: string) {
    return this.core.store.get(`${scope || this.name}:${key}`);
  }

  setGlobalDependencies(name: string, version?: string) {
    if (!this.core.service.globalDependencies) {
      this.core.service.globalDependencies = {};
    }
    this.core.service.globalDependencies[name] = version || '*';
  }
}

// 通过命令过滤插件
export const filterPluginByCommand = (pluginList, options) => {
  const { command, platform, cwd = process.cwd(), load } = options || {};
  return pluginList.filter(plugin => {
    if (!plugin || !plugin.mod) {
      return false;
    }
    // 如果存在命令匹配
    if (plugin.command) {
      if (Array.isArray(plugin.command)) {
        if (plugin.command.indexOf(command) === -1) {
          return false;
        }
      } else if (plugin.command !== command) {
        return false;
      }
    }
    // 平台不一致
    if (plugin.platform) {
      if (plugin.platform !== platform) {
        return false;
      }
    }
    try {
      const pluginJson = load(plugin.mod + '/plugin.json');
      if (pluginJson.match) {
        // 匹配命令是否一致
        if (pluginJson.match.command) {
          if (Array.isArray(pluginJson.match.command)) {
            if (pluginJson.match.command.indexOf(command) === -1) {
              return false;
            }
          } else if (pluginJson.match.command !== command) {
            return false;
          }
        }
        // 匹配文件是否存在
        if (pluginJson.match.file) {
          const filePath = resolve(cwd, pluginJson.match.file);
          if (!existsSync(filePath)) {
            return false;
          }
        }
        return true;
      }
    } catch {
      //
    }
    return true;
  });
};

// 获取插件的class列表
export const getPluginClass = async (pluginList, options) => {
  const { cwd, npm, load, notAutoInstall } = options;
  const classList = [];
  for (const pluginInfo of pluginList) {
    let mod;
    try {
      mod = load(pluginInfo.mod);
    } catch {
      if (notAutoInstall) {
        continue;
      }
      let userModPath = resolve(cwd, 'node_modules', pluginInfo.mod);
      // if plugin not exists, auto install
      if (!existsSync(userModPath)) {
        await autoInstallMod(pluginInfo.mod, {
          cwd,
          npm,
        });
      }
      // 避免失败的require cache
      const newPkgPath = resolve(userModPath, 'package.json');
      if (!existsSync(newPkgPath)) {
        continue;
      }
      const pkg = JSON.parse(readFileSync(newPkgPath).toString());
      if (pkg.main) {
        userModPath = resolve(userModPath, pkg.main);
      }
      try {
        mod = load(userModPath);
      } catch (e) {
        // no oth doing
      }
    }
    if (!mod) {
      continue;
    }
    if (pluginInfo.name) {
      if (mod[pluginInfo.name]) {
        classList.push(mod[pluginInfo.name]);
      }
    } else {
      classList.push(mod);
    }
  }
  return classList;
};

const autoInstallMod = async (
  modName: string,
  options: {
    cwd: string;
    npm: string;
  }
) => {
  console.log(
    `[ midway ] CLI plugin '${modName}' was not installed, and will be installed automatically`
  );
  if (!options.npm) {
    console.log(
      '[ midway ] You could use the `--npm` parameter to speed up the installation process'
    );
  }
  const spin = new Spin({ text: 'installing' });
  spin.start();
  try {
    await installNpm({
      npmName: modName,
      register: options.npm,
      baseDir: options.cwd,
      slience: true,
    });
  } catch (e) {
    console.error(
      `[ midway ] cli plugin '${modName}' install error: ${e?.message}`
    );
    console.log(`[ midway ] please manual install '${modName}'`);
  }
  spin.stop();
};
