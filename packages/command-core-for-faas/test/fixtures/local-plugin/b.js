class BPlugin {
  constructor(core, options) {
      this.core = core;
      this.options = options;
      this.commands = {
        a: {
          usage: 'a command',
          lifecycleEvents: ['a'],
        },
      };
      this.hooks = {};
  }
}
exports.BPlugin = BPlugin;