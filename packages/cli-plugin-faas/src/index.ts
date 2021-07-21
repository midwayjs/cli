import {
  BasePlugin,
  filterPluginByCommand,
  getPluginClass,
} from '@midwayjs/command-core';
import { getSpecFile, loadSpec } from '@midwayjs/serverless-spec-builder';
import { PluginList } from './plugins';
export class FaaSPlugin extends BasePlugin {
  async asyncInit() {
    const { cwd } = this.core;
    const specFileInfo = getSpecFile(cwd);
    if (!this.core.service?.provider?.name) {
      const spec = loadSpec(cwd, specFileInfo);
      // 挂载service
      this.core.service = spec;
    }
    if (!this.core.config) {
      this.core.config = {};
    }
    this.core.coreOptions.provider = this.core.service?.provider?.name;
    if (!this.core.config.servicePath) {
      this.core.config.servicePath = cwd;
    }
    if (!this.core.config.specFile) {
      this.core.config.specFile = specFileInfo;
    }
    // 加载faas的插件
    let needLoad = PluginList;
    const { options, commands } = this.core.coreOptions;
    const command = commands?.[0];

    needLoad = filterPluginByCommand(PluginList, {
      command,
      cwd: this.core.cwd,
      // 当没有 command 或者 仅执行 help 的时候，不加载平台私有插件
      platform:
        !options?.h && command
          ? this.core.service?.provider?.name
          : 'unplatform',
    });

    this.core.debug('FaaS Plugin load list', command, needLoad);
    const allPluginClass = await getPluginClass(needLoad, {
      cwd: this.core.cwd,
      load: name => {
        try {
          return require(name);
        } catch (e) {
          this.core.debug('Load FaaS Plugin Error', e);
          throw e;
        }
      },
      npm: options.npm,
      notAutoInstall: options?.h,
    });
    allPluginClass.forEach(pluginClass => {
      this.core.addPlugin(pluginClass);
    });
    if (!this.core.service.plugins) {
      return;
    }
    this.core.debug('FaaS Plugin load Spec Plugin', this.core.service.plugins);
    for (const plugin of this.core.service.plugins) {
      if (/^npm:/.test(plugin) || /^local:/.test(plugin)) {
        this.core.addPlugin(plugin);
      } else if (/^\./.test(plugin)) {
        this.core.addPlugin(
          `local:${this.core.coreOptions.provider || ''}:${plugin}`
        );
      }
    }
  }
}
