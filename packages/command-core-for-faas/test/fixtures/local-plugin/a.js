class APlugin {
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
exports.APlugin = APlugin;