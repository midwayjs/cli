import { BasePlugin } from '../../src';

class ErrorPlugin extends BasePlugin {
  commands = {
    common: {
      usage: 'common command',
      lifecycleEvents: ['main'],
      commands: {
        aaa: {
          lifecycleEvents: ['a'],
        },
      },
    },
  };
  hooks = {
    'common:main': async () => {
      throw new Error('hook123');
    },
    'common:aaa:a': async () => {
      throw new Error('hookaerror');
    },
  };
}

export default ErrorPlugin;
