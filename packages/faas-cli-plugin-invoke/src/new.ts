// 子进程模式进行函数调用
import { BasePlugin } from '@midwayjs/command-core';
import { fork } from 'child_process';

export class NewFaaSInvokePlugin extends BasePlugin {
  baseDir: string;
  child;
  childStartStatus = 'starting';
  invokeResolveMap = {};
  commands = {
    invoke: {
      usage: '',
      lifecycleEvents: [
        'formatOptions', // 处理参数
        'locator', // 分析目录结构
        'watch', // 启动watch
        'analysisCode', // 代码分析，向前兼容，如果有已分析结果则跳过
        'startChild', // 启动子进程
        'formatEvent', // 参数进行转换
        'getInvoke', // 获取runtime
        'callInvoke', // 进行调用
        'clearChild', // 清理子进程
        // 'clean', // 进行清理
      ],
      options: {
      },
    },
  };

  hooks = {
    'invoke:startChild': this.startChild.bind(this),
    'invoke:callInvoke': this.callInvoke.bind(this),
    'invoke:clearChild': this.clearChild.bind(this),
  };


  async waitStartChild(count = 1) {
    if (this.childStartStatus === 'started') {
      return;
    }
    if (count > 10) {
      return 'error';
    }
    return new Promise(resolve => {
      setTimeout(() => {
        this.waitStartChild(count + 1).then(resolve);
      }, 200);
    });
  }

  async startChild() {
    if (this.child) {
      if (this.childStartStatus === 'started') {
        return;
      } else if (this.childStartStatus === 'starting') {
        const status = await this.waitStartChild();
        if (status === 'started') {
          return;
        }
      }
    }

    const {
      faasModName,
      faasStarterName,
      starterModule,
    } = this.getEntryInfo();



    const options = {
      functionDir: this.options.functionDir,
      faasModName,
      faasStarterName,
      starterModule,
    };
    this.childStartStatus = 'starting';
    this.child = fork(
      require.resolve('./child'),
      [JSON.stringify(options, null, 2)],
      {
        cwd: this.core.cwd,
        env: {
          ...process.env,
          MIDWAY_TS_MODE: 'true',
        },
        silent: true,
        execArgv: ['-r', '@midwayjs/mwcc/register'],
      }
    );
    this.child.stdout.on('data', data => {
      console.log('data', data.toString());
    });
    this.child.stderr.on('data', data => {
      console.log('error', data.toString());
    });
    this.child.on('message', msg => {
      if (msg.type === 'started') {
        this.childStartStatus = 'started';
      } else if (msg.type === 'error') {
        this.childStartStatus = 'error';
      }  else if (msg.type === 'result') {
        if (this.invokeResolveMap[msg.id]) {
          this.invokeResolveMap[msg.id](msg);
        }
      }
    });
  }

  async callInvoke() {
    const id = Date.now() + ':' + Math.random();
    const invoke = new Promise(resolve => {
      this.invokeResolveMap[id] = resolve;
    });
    this.child.send({ type: 'invoke', id, handler: 'http.handler', args: [{}, {}] });
    const result = await invoke;
    delete this.invokeResolveMap[id];
    console.log('result', result);
  }

  async clearChild() {
    if(!this.options.watch) {
      this.child.kill();
      this.child = null;
    }
  }

  getPlatform() {
    const provider =
      this.core.service.provider && this.core.service.provider.name;
    if (provider) {
      if (provider === 'fc' || provider === 'aliyun') {
        return 'aliyun';
      } else if (provider === 'scf' || provider === 'tencent') {
        return 'tencent';
      }
    }
    return provider;
  }

  getStarterModName() {
    const platform = this.getPlatform();
    this.core.debug('Platform entry', platform);
    if (platform === 'aliyun') {
      return require.resolve('@midwayjs/serverless-fc-starter');
    } else if (platform === 'tencent') {
      return require.resolve('@midwayjs/serverless-scf-starter');
    }
  }

  public getEntryInfo() {
    return {
      faasModName: process.env.MidwayModuleName || '@midwayjs/faas',
      faasStarterName: 'FaaSStarter',
      starterModule: this.getStarterModName(),
    };
  }


  
}
