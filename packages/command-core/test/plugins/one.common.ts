import { BasePlugin } from '../../src';

class Provider {
  static getProviderName() {
    return 'one';
  }
}

class OnePlugin extends BasePlugin {
  provider = new Provider();
  commands = {
    common: {
      usage: 'common command',
      lifecycleEvents: ['main'],
    },
  };

  v = 1;

  async asyncInit() {
    return new Promise<void>(resolve => {
      setTimeout(() => {
        this.v = 2;
        resolve();
      }, 1000);
    });
  }
  hooks = {
    'common:main': async () => {
      this.core.setProvider('a', 1);
      const value = this.core.getProvider('a');
      if (value !== 1 || this.v !== 2) {
        throw new Error('provide error');
      }
    },
  };
}

export default OnePlugin;
