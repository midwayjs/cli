import { BasePlugin } from '@midwayjs/command-core';
import { forkNode } from './utils';
import { existsSync } from 'fs';
import * as globby from 'globby';
import { join } from 'path';
export class TestPlugin extends BasePlugin {
  commands = {
    test: {
      usage: 'Test a Serverless service',
      lifecycleEvents: ['test'],
      options: {
        cov: {
          usage: 'get code coverage report',
          shortcut: 'c',
        },
        watch: {
          usage: 'watch',
          shortcut: 'w',
        },
        reporter: {
          usage: 'set mocha reporter',
          shortcut: 'r',
        },
        file: {
          usage: 'specify a test file',
          shortcut: 'f',
        },
      },
    },
  };

  hooks = {
    'test:test': this.run.bind(this),
  };

  async run() {
    let testFiles = [];
    if (this.options.f) {
      testFiles = [this.options.f];
      this.core.cli.log(`Testing ${this.options.f}`);
    } else {
      this.core.cli.log('Testing all *.test.js/ts...');
    }
    // exec bin file
    const binFile = require.resolve('jest/bin/jest');
    const execArgv = process.execArgv || [];
    const cwd = this.core.cwd;
    const isTs = existsSync(join(cwd, 'tsconfig.json'));
    const opt = {
      cwd,
      env: Object.assign(
        {
          MIDWAY_TS_MODE: isTs,
          MIDWAY_JEST_MODE: true,
        },
        process.env,
        {
          NODE_ENV: 'test',
        }
      ),
      execArgv,
    };
    const args = await this.formatTestArgs(isTs, testFiles);
    if (!args) {
      return;
    }
    return forkNode(binFile, args, opt);
  }

  async formatTestArgs(isTs, testFiles) {
    const args = [];
    if (isTs) {
      args.push('--require', require.resolve('ts-node/register'));
    }

    let pattern;

    if (!pattern) {
      pattern = testFiles;
    }
    if (!pattern.length && process.env.TESTS) {
      pattern = process.env.TESTS.split(',');
    }

    if (!pattern.length) {
      pattern = [`test/**/*.test.${isTs ? 'ts' : 'js'}`];
    }
    pattern = pattern.concat(['!test/fixtures', '!test/node_modules']);

    const files = globby.sync(pattern);
    if (files.length === 0) {
      console.log(`No test files found with ${pattern}`);
      return;
    }
    args.push('--findRelatedTests', ...files);

    if (this.options.cov) {
      args.push('--coverage');
    }
    return args;
  }
}
