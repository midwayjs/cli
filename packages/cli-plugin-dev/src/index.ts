import {
  BasePlugin,
  exec,
  findNpmModuleByResolve,
} from '@midwayjs/command-core';
import { fork } from 'child_process';
import Spin from 'light-spinner';
import * as chokidar from 'chokidar';
import { networkInterfaces, platform } from 'os';
import { resolve, relative, join } from 'path';
import { statSync, existsSync, readFileSync, writeFileSync } from 'fs';
import * as chalk from 'chalk';
import * as detect from 'detect-port';
import { parse } from 'json5';
import { checkPort, tsNodeFastEnv } from './utils';
export class DevPlugin extends BasePlugin {
  private child;
  private started = false;
  private restarting = false;
  private port: string | number;
  private processMessageMap = {};
  private spin;
  private tsconfigJson;
  private childProcesslistenedPort; // child process listen port
  private isInClosing = false;
  private startTime = Date.now();
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
        watchFilePatten: {
          usage: 'watch more files by glob patten',
        },
        unWatchFilePatten: {
          usage: 'unwatch files by glob patten',
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
    const defaultPort = this.options.randomPort
      ? Math.ceil(1000 + Math.random() * 9000)
      : 7001;
    this.port = this.options.port;
    // 如果用户通过 --port 传了，就赋值到 MIDWAY_HTTP_PORT 环境变量上面去，此处为兼容 3.x 写法
    if (this.port) {
      process.env.MIDWAY_HTTP_PORT = `${this.port}`;
    }
    // 此处为兼容 2.x 写法，在 2.x 的情况下，没有传递 port 则自动选择一个
    if (!this.port && (!this.options.entryFile || this.options.detectPort)) {
      this.port = await detect(defaultPort);
    }
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
    process.on('exit', this.handleClose.bind(this, 'exit', false));
    process.on('SIGINT', this.handleClose.bind(this, 'SIGINT', true));
    process.on('SIGTERM', this.handleClose.bind(this, 'SIGTERM', true));
    process.on('disconnect', this.handleClose.bind(this, 'disconnect', true));
    this.setStore(
      'dev:closeApp',
      this.handleClose.bind(this, 'dev:closeApp'),
      true
    );
    const options = this.getOptions();
    await this.start();
    if (!options.notWatch) {
      this.startWatch();
    }
    if (!options.notAwait) {
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
        // MIDWAY_DEV_IS_SERVERLESS 决定了使用 createFunctionApp 来启动
        process.env.MIDWAY_DEV_IS_SERVERLESS = 'true';
        try {
          // eslint-disable-next-line
          framework = require.resolve('@midwayjs/serverless-app');
          process.env.MIDWAY_DEV_IS_SERVERLESS_APP = 'true';
        } catch {
          //
        }
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
    this.isInClosing = false;
    return new Promise<void>(async resolve => {
      this.clearTernimal();
      const options = this.getOptions();
      this.core.debug('start options', options);
      if (this.spin) {
        this.spin.stop();
      }
      this.spin = new Spin({
        text: this.started ? 'Midway Restarting' : 'Midway Starting',
      });
      if (!options.silent) {
        this.spin.start();
      }

      let tsNodeFast = {};
      if (options.fast) {
        tsNodeFast = tsNodeFastEnv;
      }

      let execArgv = [];
      let MIDWAY_DEV_IS_DEBUG;
      let useIncrementalBuild = false;

      if (options.ts) {
        let fastRegister;
        if (typeof options.fast === 'string' && options.fast !== 'true') {
          const pluginName = `@midwayjs/cli-plugin-${options.fast}`;
          this.core.debug('faster pluginName', pluginName);
          try {
            const pkg = require.resolve(`${pluginName}/package.json`);
            fastRegister = join(pkg, `../js/${options.fast}-register.js`);
            this.core.debug('fastRegister', fastRegister);
            if (!existsSync(fastRegister)) {
              fastRegister = '';
            }
          } catch {
            throw new Error(
              `please install @midwayjs/cli-plugin-${options.fast} to using fast mode '${options.fast}'`
            );
          }
          if (fastRegister) {
            execArgv = ['-r', fastRegister];
          }
        }
        if (!fastRegister) {
          let tsRegister = this.getTsNodeRegister();
          if (this.tsconfigJson?.compilerOptions?.incremental) {
            useIncrementalBuild = true;
            tsNodeFast = tsNodeFastEnv;
            process.env.MW_CLI_TS_NODE = findNpmModuleByResolve(
              this.core.cwd,
              'ts-node'
            );
            process.env.MW_CLI_SOURCE_DIR = this.getSourceDir();
            tsRegister = join(__dirname, '../js/register');
          }
          execArgv = ['-r', tsRegister];
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
          this.core.cli.log(`\n\nDebug port ${port} is in use\n\n`);
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

      if (
        useIncrementalBuild ||
        (this.options.ts && this.options.fast === 'swc')
      ) {
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
          this.childProcesslistenedPort = msg.port;

          this.spin.stop();
          while (dataCache.length) {
            process.stdout.write(dataCache.shift());
          }
          this.restarting = false;
          if (msg.startSuccess) {
            if (!this.started) {
              this.started = true;
              this.core.debug('start time', Date.now() - this.startTime);
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

  private getTsNodeRegister() {
    const tsNodePath = findNpmModuleByResolve(this.core.cwd, 'ts-node');
    if (tsNodePath) {
      return join(tsNodePath, 'register');
    }
    const errorMsg = [
      '!!!',
      '未找到 ts-node 来处理您的 Typescript 代码',
      '请手动安装 ts-node@10 依赖之后再次执行 midway-bin dev --ts',
      '---',
    ].join('\n');
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  private async handleClose(type, isExit?, signal?) {
    this.core.debug('handleClose', type, isExit, signal, this.isInClosing);
    if (this.isInClosing) {
      return;
    }
    this.isInClosing = true;
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
      // 无论上述close 是否成功关闭，都强行关闭一次
      const isWin = platform() === 'win32';
      try {
        if (!isWin) {
          await exec({
            cmd: `kill -9 ${this.child.pid} || true`,
            slience: true,
          });
        }
      } catch {
        //
      }
      if (this.child?.kill) {
        this.child.kill();
      }
      if (closeChildRes === childExitError) {
        this.log('Pre Process Force Exit.');
      }
      this.child = null;
    }
    if (isExit) {
      process.exit(signal);
    }
    this.isInClosing = false;
  }

  private async restart() {
    this.startTime = Date.now();
    await this.handleClose('restart');
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

  private clearTernimal() {
    if (this.options.preserveOutput || process.env.MIDWAY_CLI_PRESERVE_OUTPUT) {
      return;
    }
    if (process.platform === 'win32') {
      this.core.cli.log('\u001B[2J\u001B[0f');
    } else {
      this.core.cli.log('\u001B[2J\u001B[3J\u001B[H');
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
      cwd: this.core.cwd,
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
        if (existsSync(filePath)) {
          this.core.debug('other watch file', filePath);
          watcher.add(filePath);
        } else {
          this.core.debug('other watch picomatch rule', file);
          watcher.add(file);
        }
      });
    }
    if (this.options.watchFilePatten) {
      const watchFilePattenList = this.options.watchFilePatten.split(',');
      watchFilePattenList.forEach(file => {
        const filePath = resolve(this.core.cwd, file);
        this.core.debug('watch glob patten', filePath);
        watcher.add(filePath);
      });
    }
    if (this.options.unWatchFilePatten) {
      const unWatchFilePattenList = this.options.unWatchFilePatten.split(',');
      unWatchFilePattenList.forEach(file => {
        const filePath = resolve(this.core.cwd, file);
        this.core.debug('unwatch glob patten', filePath);
        watcher.unwatch(filePath);
      });
    }
    watcher.on('all', (event, path) => {
      if (this.restarting) {
        return;
      }
      this.restarting = true;
      this.restart().then(() => {
        this.core.debug('restart time', Date.now() - this.startTime);
        this.log(
          `Auto reload. ${chalk.hex('#666666')(
            `[${event}] ${relative(sourceDir, path)}`
          )}`
        );
      });
    });
  }

  private displayStartTips(options) {
    this.port = this.childProcesslistenedPort || this.port;
    process.env.MIDWAY_LOCAL_DEV_PORT = String(this.port);

    this.setStore('dev:port', this.port, true);
    if (options.silent || options.notStartLog) {
      return;
    }

    if (!process.env.MIDWAY_LOCAL_DEV_PORT) {
      return;
    }

    const protocol = options.ssl ? 'https' : 'http';
    this.log(
      'Start Server at ',
      chalk.hex('#9999ff').underline(`${protocol}://127.0.0.1:${this.port}`)
    );
    const lanIp = this.getIp();
    if (lanIp) {
      this.log(
        'Start on LAN',
        chalk.hex('#9999ff').underline(`${protocol}://${lanIp}:${this.port}`)
      );
    }
    this.core.cli.log('');
    this.core.cli.log('');
  }

  private log(...args: any[]) {
    this.core.cli.log('[ Midway ]', ...args);
  }

  private error(...args: any[]) {
    console.error(chalk.hex('#ff0000')(...args));
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
