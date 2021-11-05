import { BasePlugin } from '@midwayjs/command-core';
import { fork, execSync } from 'child_process';
import Spin from 'light-spinner';
import * as chokidar from 'chokidar';
import { networkInterfaces, platform } from 'os';
import { resolve, relative, join } from 'path';
import { statSync, existsSync, readFileSync, writeFileSync } from 'fs';
import * as chalk from 'chalk';
import * as detect from 'detect-port';
import { parse } from 'json5';
import { checkPort } from './utils';
export class DevPlugin extends BasePlugin {
  private child;
  private started = false;
  private restarting = false;
  private port = 7001;
  private processMessageMap = {};
  private spin;
  private tsconfigJson;
  commands = {
    dev: {
      lifecycleEvents: ['checkEnv', 'run'],
      options: {
        baseDir: {
          usage: 'directory of application, default to `process.cwd()`',
        },
        port: {
          usage: 'listening port, default to 7001',
          shortcut: 'p',
        },
        debug: {
          usage: 'midway debug',
        },
        framework: {
          usage: 'specify framework that can be absolute path or npm package',
        },
        entryFile: {
          usage: 'specify entry file, like bootstrap.js',
          shortcut: 'f',
        },
        notWatch: {
          usage: 'not watch file change',
        },
        fast: {
          usage: 'fast mode',
        },
        sourceDir: {
          usage: 'ts code source dir',
        },
        layers: {
          usage: 'extend serverless by layer',
        },
        watchFile: {
          usage: 'watch more file',
        },
        watchExt: {
          usage: 'watch more extensions',
        },
        detectPort: {
          usage: 'when using entryFile, auto detect port',
        },
      },
    },
  };

  hooks = {
    'dev:checkEnv': this.checkEnv.bind(this),
    'dev:run': this.run.bind(this),
  };

  async checkEnv() {
    this.setStore('dev:getData', this.getData.bind(this), true);
    // 仅当不指定entry file的时候才处理端口
    this.port = this.options.port || 7001;
    if (!this.options.entryFile || this.options.detectPort) {
      const port = await detect(this.port);
      if (port !== this.port) {
        if (!this.options.silent) {
          this.log(
            `Server port ${this.port} is in use, now using port ${port}`
          );
        }
        this.port = port;
      }
    }
    process.env.MIDWAY_LOCAL_DEV_PORT = String(this.port);
    this.setStore('dev:port', this.port, true);
    const cwd = this.core.cwd;
    if (this.options.ts === undefined) {
      if (existsSync(resolve(cwd, 'tsconfig.json'))) {
        this.options.ts = true;
      }
    }

    // ts 模式需要校验tsconfig中的ts-node配置是否有module: commonjs
    if (this.options.ts) {
      this.checkTsConfigTsNodeModule();
    }
  }

  async run() {
    process.on('exit', this.handleClose.bind(this, false));
    process.on('SIGINT', this.handleClose.bind(this, true));
    this.setStore('dev:closeApp', this.handleClose.bind(this), true);
    const options = this.getOptions();
    await this.start();
    if (!options.notWatch) {
      this.startWatch();
      return new Promise(() => {});
    }
  }

  protected getOptions() {
    let framework;
    const layers: string[] = this.options.layers
      ? this.options.layers.split(',')
      : [];
    const cwd = this.core.cwd;
    const yamlPath = resolve(cwd, 'f.yml');
    if (!this.options.framework && existsSync(yamlPath)) {
      const ymlData = readFileSync(yamlPath).toString();
      if (!/deployType/.test(ymlData)) {
        process.env.MIDWAY_DEV_IS_SERVERLESS = 'true';
        // eslint-disable-next-line
        framework = require.resolve('@midwayjs/serverless-app');
      }
    }

    return {
      framework,
      baseDir: this.getSourceDir(),
      ...this.options,
      layers,
      port: this.port,
    };
  }

  private start() {
    return new Promise<void>(async resolve => {
      const options = this.getOptions();
      this.spin = new Spin({
        text: this.started ? 'Midway Restarting' : 'Midway Starting',
      });
      if (!options.silent) {
        this.spin.start();
      }

      let tsNodeFast = {};
      if (options.fast) {
        tsNodeFast = {
          TS_NODE_FILES: 'true',
          TS_NODE_TRANSPILE_ONLY: 'true',
        };
      }

      let execArgv = [];
      let MIDWAY_DEV_IS_DEBUG;

      if (options.ts) {
        if (options.fast === 'esbuild') {
          execArgv = ['-r', join(__dirname, '../js/esbuild-register.js')];
        } else {
          execArgv = ['-r', 'ts-node/register'];
          if (this.tsconfigJson?.compilerOptions?.baseUrl) {
            execArgv.push('-r', 'tsconfig-paths/register');
          }
        }
      }

      if (options.debug) {
        const debugStr = options.debug.toString();
        const port = /^\d+$/.test(debugStr) ? options.debug : '9229';
        this.core.debug('Debug port:', port);
        const portIsUse: boolean = await checkPort(port);
        if (portIsUse) {
          console.log(`\n\nDebug port ${port} is in use\n\n`);
        } else {
          MIDWAY_DEV_IS_DEBUG = port;
          execArgv.push(`--inspect=${port}`);
        }
      }

      this.child = fork(require.resolve('./child'), [JSON.stringify(options)], {
        cwd: this.core.cwd,
        env: {
          IN_CHILD_PROCESS: 'true',
          TS_NODE_FILES: 'true',
          MIDWAY_DEV_IS_DEBUG,
          ...tsNodeFast,
          ...process.env,
        },
        silent: true,
        execArgv,
      });

      if (this.options.ts && this.options.fast === 'esbuild') {
        this.checkTsType();
      }

      const dataCache = [];
      this.child.stdout.on('data', data => {
        if (this.restarting) {
          dataCache.push(data);
        } else {
          process.stdout.write(data);
        }
      });
      this.child.stderr.on('data', data => {
        this.error(data.toString());
      });
      this.child.on('message', msg => {
        if (msg.type === 'started') {
          this.spin.stop();
          while (dataCache.length) {
            process.stdout.write(dataCache.shift());
          }
          this.restarting = false;
          if (msg.startSuccess) {
            if (!this.started) {
              this.started = true;
              this.displayStartTips(options);
            }
          }
          resolve();
        } else if (msg.type === 'error') {
          this.spin.stop();
          this.error(msg.message || '');
        } else if (msg.id) {
          if (this.processMessageMap[msg.id]) {
            this.processMessageMap[msg.id](msg.data);
            delete this.processMessageMap[msg.id];
          }
        }
      });
    });
  }

  private async handleClose(isExit?, signal?) {
    if (this.spin) {
      this.spin.stop();
    }
    if (this.child) {
      const childExitError = 'childExitError';
      const closeChildRes = await new Promise(resolve => {
        if (this.child.connected) {
          const id = Date.now() + ':exit:' + Math.random();
          setTimeout(() => {
            delete this.processMessageMap[id];
            resolve(childExitError);
          }, 2000);
          this.processMessageMap[id] = resolve;
          this.child.send({ type: 'exit', id });
        } else {
          resolve(void 0);
        }
      });
      if (closeChildRes === childExitError) {
        const isWin = platform() === 'win32';
        try {
          if (!isWin) {
            execSync(`kill -9 ${this.child.pid} || true`);
          }
          this.log('Pre Process Force Exit.');
        } catch (e) {
          this.error('Pre Process Force Exit Error', e.message);
        }
      }
      if (this.child?.kill) {
        this.child.kill();
      }
      this.child = null;
    }
    if (isExit) {
      process.exit(signal);
    }
  }

  private async restart() {
    await this.handleClose();
    await this.start();
  }

  private getIp() {
    const interfaces = networkInterfaces(); // 在开发环境中获取局域网中的本机iP地址
    for (const devName in interfaces) {
      const iface = interfaces[devName];
      for (const alias of iface) {
        if (
          alias.family === 'IPv4' &&
          alias.address !== '127.0.0.1' &&
          !alias.internal
        ) {
          return alias.address;
        }
      }
    }
  }

  private getSourceDir() {
    return resolve(this.core.cwd, this.options.sourceDir || 'src');
  }

  // watch file change
  private startWatch() {
    const sourceDir = this.getSourceDir();
    const watchAllowExts = (
      this.options.watchExt ? this.options.watchExt.split(',') : []
    ).concat('.ts', '.yml', '.json');

    const watcher = chokidar.watch(sourceDir, {
      ignored: path => {
        if (path.includes('node_modules')) {
          return true;
        }
        if (existsSync(path)) {
          const stat = statSync(path);
          if (stat.isFile()) {
            const matchExts = watchAllowExts.find(ext => {
              return path.endsWith(ext);
            });
            if (!matchExts) {
              return true;
            }
          }
        }
      }, // ignore dotfiles
      persistent: true,
      ignoreInitial: true,
    });
    const fyml = resolve(this.core.cwd, 'f.yml');
    if (existsSync(fyml)) {
      watcher.add(fyml);
    }

    if (this.options.watchFile) {
      const watchFileList = this.options.watchFile.split(',');
      watchFileList.forEach(file => {
        const filePath = resolve(this.core.cwd, file);
        this.core.debug('other watch file', filePath);
        if (existsSync(filePath)) {
          watcher.add(filePath);
        }
      });
    }
    watcher.on('all', (event, path) => {
      if (this.restarting) {
        return;
      }
      this.restarting = true;
      this.restart().then(() => {
        this.log(
          `Auto reload. ${chalk.hex('#666666')(
            `[${event}] ${relative(sourceDir, path)}`
          )}`
        );
      });
    });
  }

  private displayStartTips(options) {
    if (options.silent || options.entryFile || options.notStartLog) {
      return;
    }
    const protocol = options.ssl ? 'https' : 'http';
    this.log(
      'Start Server at ',
      chalk.hex('#9999ff').underline(`${protocol}://127.0.0.1:${options.port}`)
    );
    const lanIp = this.getIp();
    if (lanIp) {
      this.log(
        'Start on LAN',
        chalk.hex('#9999ff').underline(`${protocol}://${lanIp}:${options.port}`)
      );
    }
    this.core.cli.log('');
    this.core.cli.log('');
  }

  private log(...args: any[]) {
    console.log('[ Midway ]', ...args);
  }

  private error(...args: any[]) {
    console.error(chalk.hex('#ff0000')('[ Midway ]', ...args));
  }

  // 检测tsconfig中module的配置
  private checkTsConfigTsNodeModule() {
    const cwd = this.core.cwd;
    const tsconfig = resolve(cwd, 'tsconfig.json');
    if (!existsSync(tsconfig)) {
      return;
    }
    const tsconfigJson = parse(readFileSync(tsconfig).toString());
    this.tsconfigJson = tsconfigJson;
    if (tsconfigJson?.compilerOptions?.module?.toLowerCase() === 'commonjs') {
      return;
    }
    if (!tsconfigJson['ts-node']) {
      tsconfigJson['ts-node'] = {};
    }
    if (!tsconfigJson['ts-node'].compilerOptions) {
      tsconfigJson['ts-node'].compilerOptions = {};
    }
    if (tsconfigJson['ts-node'].compilerOptions.module === 'commonjs') {
      return;
    }
    tsconfigJson['ts-node'].compilerOptions.module = 'commonjs';
    writeFileSync(tsconfig, JSON.stringify(tsconfigJson, null, 2));
  }

  private async getData(type: string, data?: any) {
    if (!this.started) {
      throw new Error('not started');
    }
    if (!this.child) {
      throw new Error('child not started');
    }
    return new Promise((resolve, reject) => {
      const id = Date.now() + ':' + Math.random();
      setTimeout(() => {
        delete this.processMessageMap[id];
        reject(new Error('timeout'));
      }, 2000);
      this.processMessageMap[id] = resolve;
      this.child.send({ type, data, id });
    });
  }

  private async checkTsType() {
    const cwd = this.core.cwd;
    fork(require.resolve('../js/typeCheck'), [JSON.stringify({ cwd })], {
      cwd,
    });
  }
}
