import { BasePlugin } from '../../src';

// 透传命令，用命令的方式传递参数
class PassingPlugin extends BasePlugin {
  commands = {
    a: {
      passingCommand: true,
      lifecycleEvents: ['1'],
    },
  };
  hooks = {
    'a:1': async () => {
      const { commands } = this.core.coreOptions;
      const cmd = commands[1];
      if (cmd !== 'b') {
        throw new Error('passing command error');
      }
    },
  };
}

export default PassingPlugin;
