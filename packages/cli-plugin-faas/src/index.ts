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
    if (!options?.h && command) {
      needLoad = filterPluginByCommand(PluginList, {
        command,
        cwd: this.core.cwd,
        platform: this.core.service?.provider?.name,
      });
    }
    this.core.debug('FaaS Plugin load list', needLoad);
    const allPluginClass = await getPluginClass(needLoad, {
      cwd: this.core.cwd,
      load: name => require(name),
      npm: options.npm,
    });
    allPluginClass.forEach(pluginClass => {
      this.core.addPlugin(pluginClass);
    });
  }
}
