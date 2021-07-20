import { BasePlugin, forkNode } from '@midwayjs/command-core';
import { existsSync } from 'fs';
import * as globby from 'globby';
import { join } from 'path';
const mochaBin = 'mocha/bin/_mocha';
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
    const execArgv = process.execArgv || [];
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
          binFile = require.resolve(mochaBin);
        }
      } catch (e) {
        console.log('');
        console.error(
          'Using mocha test need deps ',
          this.options.cov ? 'nyc' : 'mocha'
        );
        throw e;
      }
    } else {
      binFile = require.resolve('jest/bin/jest');
      defaultOptionsEnv['MIDWAY_JEST_MODE'] = true;
      if (isTs) {
        execArgv.push('--require', require.resolve('ts-node/register'));
      }
    }

    const opt = {
      cwd,
      env: Object.assign(defaultOptionsEnv, process.env),
      execArgv,
    };

    let args;
    if (this.options.mocha) {
      args = await this.formatMochaTestArgs(isTs, testFiles);
    } else {
      args = await this.formatJestTestArgs(isTs, testFiles);
    }
    if (!args) {
      return;
    }
    this.core.debug('Test Info', binFile, args, opt);
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
        console.log('');
        console.error(`No test files found with ${pattern}`);
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

  async formatMochaTestArgs(isTs, testFiles) {
    const argsPre = [];
    const args = [];
    if (isTs) {
      argsPre.push('--require', require.resolve('ts-node/register'));
    }
    if (this.options.cov) {
      if (this.options.nyc) {
        argsPre.push(...this.options.nyc.split(' '));
        argsPre.push('--temp-directory', './node_modules/.nyc_output');
      }
      if (isTs) {
        argsPre.push('--extension');
        argsPre.push('.ts');
      }
      argsPre.push(require.resolve(mochaBin));
    } else if (this.options.extension) {
      args.push(`--extension=${this.options.extension}`);
    }
    let timeout = this.options.timeout || process.env.TEST_TIMEOUT || 60000;
    if (process.env.JB_DEBUG_FILE) {
      // --no-timeout
      timeout = false;
    }
    args.push(timeout ? `--timeout=${timeout}` : '--no-timeout');

    if (this.options.reporter || process.env.TEST_REPORTER) {
      args.push('--reporter=true');
    }

    args.push('--exit=true');

    const requireArr = [].concat(this.options.require || this.options.r || []);

    if (!this.options.fullTrace) {
      requireArr.unshift(require.resolve('./mocha-clean'));
    }

    requireArr.forEach(requireItem => {
      args.push(`--require=${requireItem}`);
    });

    let pattern;

    if (!pattern) {
      // specific test files
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

    args.push(...files);

    // auto add setup file as the first test file
    const setupFile = join(process.cwd(), `test/.setup.${isTs ? 'ts' : 'js'}`);
    if (existsSync(setupFile)) {
      args.unshift(setupFile);
    }
    return argsPre.concat(args);
  }
}
