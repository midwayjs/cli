import { BasePlugin, forkNode } from '@midwayjs/command-core';
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
        file: {
          usage: 'specify a test file',
          shortcut: 'f',
        },
        forceExit: {
          usage: 'force exit',
        },
        runInBand: {
          usage: 'runInBand',
        },
        mocha: {
          usage: 'using mocha test',
        },
      },
    },
    cov: {
      usage: 'Test a Serverless service with coverage',
      lifecycleEvents: ['test'],
      options: {
        watch: {
          usage: 'watch',
          shortcut: 'w',
        },
        file: {
          usage: 'specify a test file',
          shortcut: 'f',
        },
        forceExit: {
          usage: 'force exit',
        },
      },
    },
  };

  hooks = {
    'test:test': this.run.bind(this),
    'cov:test': async () => {
      this.options.cov = true;
      await this.run();
    },
  };

  async run() {
    const cwd = this.core.cwd;
    process.env.MIDWAY_BIN_JEST_ROOT_DIR = cwd;
    const isTs = this.options.ts || existsSync(join(cwd, 'tsconfig.json'));
    let testFiles = [];
    if (this.options.f) {
      testFiles = [this.options.f];
      this.core.cli.log(`Testing ${this.options.f}`);
    } else {
      this.core.cli.log(`Testing all *.test.${isTs ? 'ts' : 'js'}...`);
    }

    const defaultOptionsEnv = {
      MIDWAY_TS_MODE: isTs,
      NODE_ENV: 'test',
    };
    // exec bin file
    let binFile;
    if (this.options.mocha) {
      try {
        if (this.options.cov) {
          binFile = require.resolve('nyc/bin/nyc.js');
        } else {
          binFile = require.resolve('mocha/bin/_mocha');
        }
      } catch (e) {
        console.log('using mocha test need deps ', this.options.cov ? 'nyc': 'mocha');
        throw e;
      }  
    } else {
      binFile = require.resolve('jest/bin/jest');
      defaultOptionsEnv['MIDWAY_JEST_MODE'] = true;
    }
    const execArgv = process.execArgv || [];
    if (isTs) {
      execArgv.push('--require', require.resolve('ts-node/register'));
    }
    const opt = {
      cwd,
      env: Object.assign(
        defaultOptionsEnv,
        process.env
      ),
      execArgv,
    };

    let args;
    if (this.options.mocha) {
      
    } else {
      args = await this.formatJestTestArgs(isTs, testFiles);
    }
    if (!args) {
      return;
    }
    return forkNode(binFile, args, opt);
  }

  async formatJestTestArgs(isTs, testFiles) {
    const args = [];

    let pattern;

    if (!pattern) {
      pattern = testFiles;
    }
    if (!pattern.length && process.env.TESTS) {
      pattern = process.env.TESTS.split(',');
    }
    if (!pattern.length) {
      args.push(`/test/.*\\.test\\.${isTs ? 'ts' : 'js'}$`);
    } else {
      const matchPattern = pattern.concat([
        '!test/fixtures',
        '!test/node_modules',
      ]);

      let files = globby.sync(matchPattern);
      files = files.filter(file => {
        return file.endsWith(`.${isTs ? 'ts' : 'js'}`);
      });
      if (files.length === 0) {
        console.log(`No test files found with ${pattern}`);
        return;
      }
      args.push('--findRelatedTests', ...files);
    }

    if (this.options.cov) {
      args.push('--coverage');
    }

    const ignoreOptions = ['cov', 'f', 'file', 'ts', 'npm', 'debug'];

    Object.keys(this.options).forEach(option => {
      if (ignoreOptions.includes(option)) {
        return;
      }
      const value = this.options[option];
      if (typeof value === 'boolean') {
        if (value === true) {
          args.push('--' + option);
        }
      } else {
        args.push(`--${option}=${value}`);
      }
    });

    args.push(
      `--config=${join(
        __dirname,
        `../config/${isTs ? 'jest.ts.js' : 'jest.js'}`
      )}`
    );

    return args;
  }

}
