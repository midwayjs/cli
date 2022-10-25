'use strict';
const { TestEnvironment } = require('jest-environment-node');

/* eslint-disable no-useless-constructor */
class JestEnvironment extends TestEnvironment {
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
}

module.exports = JestEnvironment;
