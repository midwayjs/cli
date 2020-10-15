import { CommandCore, CoreBaseCLI } from '@midwayjs/command-core';
import { loadSpec, getSpecFile } from '@midwayjs/serverless-spec-builder';
export * from '@midwayjs/command-core';
export {
  getSpecFile,
  loadSpec,
  writeToSpec,
} from '@midwayjs/serverless-spec-builder';
export class CommandHookCore extends CommandCore {}
export class BaseCLI extends CoreBaseCLI {
  specFile: any;
  spec: any;
  providerName: any;

  initCore() {
    this.loadSpec();
    this.providerName = (this.spec.provider && this.spec.provider.name) || '';
    this.core = new CommandCore({
      config: {
        servicePath: this.cwd,
        specFile: this.specFile,
      },
      commands: this.commands,
      service: this.spec,
      provider: this.providerName,
      options: this.argv,
      log: this.loadLog(),
      displayUsage: this.displayUsage.bind(this),
      extensions: this.loadExtensions(),
      ...this.coverCoreOptions(),
    });
  }

  async loadPlugins() {
    await super.loadPlugins();
    await this.loadUserPlugin();
  }

  loadSpec() {
    this.specFile = getSpecFile(this.cwd);
    this.spec = loadSpec(this.cwd, this.specFile);
  }

  loadUserPlugin() {
    if (!this.spec || !this.spec.plugins) {
      return;
    }
    for (const plugin of this.spec.plugins) {
      if (/^npm:/.test(plugin) || /^local:/.test(plugin)) {
        this.core.addPlugin(plugin);
      } else if (/^\./.test(plugin)) {
        this.core.addPlugin(`local:${this.providerName}:${plugin}`);
      }
    }
  }
}
