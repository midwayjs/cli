import { BasePlugin } from '@midwayjs/command-core';
import { fork } from 'child_process';
import Spin from 'light-spinner';
import * as chokidar from 'chokidar';
import { networkInterfaces } from 'os';
import { resolve, relative } from 'path';
import { statSync, existsSync } from 'fs';
import * as chalk from 'chalk';
import * as detect from 'detect-port';
export class DevPlugin extends BasePlugin {
  private child;
  private started = false;
  private restarting = false;
  private port = 7001;
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
      },
    },
  };

  hooks = {
    'dev:checkEnv': this.checkEnv.bind(this),
    'dev:run': this.run.bind(this),
  };

  async checkEnv() {
    const defaultPort = this.options.port || 7001;
    const port = await detect(defaultPort);
    if (port !== defaultPort) {
      this.log(`Server port ${defaultPort} is in use, now using port ${port}`);
      this.port = port;
    } else {
      this.port = defaultPort;
    }
    this.setStore('dev:port', this.port, true);
  }

  async run() {
    process.on('exit', this.handleClose.bind(this, true));
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
    const cwd = this.core.cwd;
    if (existsSync(resolve(cwd, 'f.yml'))) {
      framework = require.resolve('@midwayjs/faas-dev-framework');
    }

    if (this.options.ts === undefined) {
      if (existsSync(resolve(cwd, 'tsconfig.json'))) {
        this.options.ts = true;
      }
    }

    return {
      framework,
      ...this.options,
      port: this.port,
    };
  }

  private start() {
    return new Promise<void>(resolve => {
      const options = this.getOptions();
      const spin = new Spin({
        text: this.started ? 'restarting' : 'starting',
      });
      if (!options.silent) {
        spin.start();
      }
      this.child = fork(
        require.resolve('./child'),
        [JSON.stringify(options, null, 2)],
        {
          cwd: this.core.cwd,
          env: {
            TS_NODE_TRANSPILE_ONLY: 'true',
            ...process.env,
          },
          silent: true,
          execArgv: options.ts ? ['-r', 'ts-node/register'] : [],
        }
      );
      const dataCache = [];
      this.child.stdout.on('data', data => {
        if (options.silent) {
          return;
        }
        if (this.restarting) {
          dataCache.push(data);
        } else {
          process.stdout.write(data);
        }
      });
      this.child.stderr.on('data', data => {
        console.error(chalk.hex('#ff0000')(data.toString()));
      });
      this.child.on('message', msg => {
        if (msg.type === 'started') {
          spin.stop();
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
          spin.stop();
          console.error(
            chalk.hex('#ff0000')(`[ Midway ] ${msg.message || ''}`)
          );
        }
      });
    });
  }

  private async handleClose(isExit?, signal?) {
    if (this.child) {
      this.child.kill();
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

  // watch file change
  private startWatch() {
    const sourceDir = resolve(this.core.cwd, 'src');
    const watcher = chokidar.watch(sourceDir, {
      ignored: path => {
        if (path.includes('node_modules')) {
          return true;
        }
        if (existsSync(path)) {
          const stat = statSync(path);
          if (stat.isFile()) {
            if (!path.endsWith('.ts') && !path.endsWith('.yml')) {
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
    if (options.silent || options.entryFile) {
      return;
    }
    this.log(
      'Start Server at ',
      chalk.hex('#9999ff').underline('http://127.0.0.1:' + options.port)
    );
    const lanIp = this.getIp();
    if (lanIp) {
      this.log(
        'Start on LAN',
        chalk.hex('#9999ff').underline(`http://${lanIp}:${options.port}`)
      );
    }
    this.core.cli.log('');
    this.core.cli.log('');
  }

  private log(...args: any[]) {
    console.log('[ Midway ]', ...args);
  }
}
