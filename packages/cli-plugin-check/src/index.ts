import { BasePlugin } from '@midwayjs/command-core';
import { Check } from './check';
export { Check } from './check';
export class CheckPlugin extends BasePlugin {
  checkInstance: Check;
  analysisResult;
  commands = {
    check: {
      lifecycleEvents: ['initial', 'print'],
      options: {},
    },
  };

  hooks = {
    'check:initial': this.initial.bind(this),
    'check:analysis': this.analysis.bind(this),
    'check:print': this.print.bind(this),
  };

  async initial() {
    this.checkInstance = new Check(this.core.cwd, this.options.srcDir || 'src');
  }

  async analysis() {
    this.analysisResult = await this.checkInstance.analysis();
  }

  async print() {
    console.log(this.analysisResult);
  }
}
