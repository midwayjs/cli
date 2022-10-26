'use strict';
const { findNpmModuleByResolve } = require('@midwayjs/command-core');
const jestNode = findNpmModuleByResolve(process.cwd(), 'jest-environment-node');
let JestEnvironment = class {};
if (jestNode) {
  const jestNodeMod = require(jestNode);
  const BaseClass = jestNodeMod.TestEnvironment || jestNodeMod;
  JestEnvironment = class extends BaseClass {
    constructor(config, context) {
      super(config, context);
    }

    async setup() {
      require('ts-node/register');
      this.global.process.env.MIDWAY_TS_MODE = 'true';
      this.global.process.env.MIDWAY_JEST_MODE = 'true';
      await super.setup();
    }

    async teardown() {
      await super.teardown();
    }

    runScript(script) {
      return super.runScript(script);
    }
  };
}
module.exports = JestEnvironment;
