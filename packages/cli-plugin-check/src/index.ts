import { BasePlugin } from '@midwayjs/command-core';
export class CheckPlugin extends BasePlugin {
  commands = {
    check: {
      usage: 'find your code bugs',
      lifecycleEvents: ['start', 'check', 'output'],
    },
  };

  hooks = {
    'check:start': this.start.bind(this),
    'check:check': this.check.bind(this),
  };

  async start() {
    // check project type
  }

  async check() {
    
  }
}
