import { BasePlugin } from '../../src';

class TestPlugin extends BasePlugin {
  commands = {
    common: {
      usage: 'common command',
      lifecycleEvents: ['main'],
    },
    x: {
      usage: 'x',
      lifecycleEvents: ['main'],
      options: {
        project: null,
      },
      commands: {
        xChild: {
          usage: 'xChild usage',
          alias: 'abc',
          lifecycleEvents: ['xx'],
          options: {
            name: {
              shortcut: 'xn',
              usage: 'xChild name option',
            },
          },
          commands: {
            xChildChild: {
              alias: 'def',
              usage: 'xChild child usage',
              lifecycleEvents: ['xx'],
              options: {
                age: {
                  usage: 'super child age',
                },
              },
            },
          },
        },
      },
    },
    noLifecycleEvents: {
      usage: 'noLifecycleEvents',
      options: {
        clean: {
          usage: 'clean build target dir',
          shortcut: 'c',
        },
        project: null,
        srcDir: {
          usage: 'source code path',
        },
        entrypoint: {
          usage: 'bundle the source with the file given as entrypoint',
        },
        minify: {
          usage: '',
        },
        mode: {
          usage: 'bundle mode, "debug" or "release" (default)', // release
        },
        tsConfig: {
          usage: 'tsConfig json object data',
        },
      },
    },
  };
  hooks = {
    'common:main': async () => {
      this.core.cli.error('1234');
    },
  };
}

export default TestPlugin;
