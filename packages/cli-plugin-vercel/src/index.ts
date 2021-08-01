import { BasePlugin, ICoreInstance } from '@midwayjs/command-core';
import { join } from 'path';
import * as globby from 'globby';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  ensureDir,
  remove,
} from 'fs-extra';
import { convertMethods } from './utils';
import { writeWrapper } from '@midwayjs/serverless-spec-builder';
// refs: vercel.com/docs/configuration
export class VercelPlugin extends BasePlugin {
  core: ICoreInstance;
  options: any;
  provider = 'vercel';
  servicePath = this.core.config.servicePath;
  midwayBuildPath = join(this.servicePath, '.serverless');
  vercelJsonFile = join(this.midwayBuildPath, 'vercel.json');

  hooks = {
    'package:generateSpec': this.generateVercelJson.bind(this),
    'package:generateEntry': this.gengerateVercelEntry.bind(this),
    'deploy:deploy': this.vercelDeploy.bind(this),
  };

  getFunctionList() {
    const functions = this.core.service.functions || {};
    const funcList = [];
    for (const func in functions) {
      const funcConf = functions[func];
      if (funcConf._ignore) {
        continue;
      }
      funcList.push({
        funcName: func,
        funcInfo: funcConf,
        entryFileName: `api/${func}.js`,
      });
    }
    return funcList;
  }

  // generate version.json to midwayBuildPath
  async generateVercelJson() {
    const funcList = this.getFunctionList();

    let vercelJson: any = {};
    if (existsSync(this.vercelJsonFile)) {
      vercelJson = JSON.parse(readFileSync(this.vercelJsonFile).toString());
    }
    if (!vercelJson.functions) {
      vercelJson.functions = {};
    }
    if (!vercelJson.functions) {
      vercelJson.functions = {};
    }

    if (!vercelJson.routes) {
      vercelJson.routes = [];
    }

    for (const func of funcList) {
      const { funcInfo, entryFileName } = func;
      if (!vercelJson.functions[entryFileName]) {
        vercelJson.functions[entryFileName] = {
          memory: 128, // 0 - 1024, step 64
          maxDuration: 10, // 0 - 10
        };
      }

      if (!funcInfo.events || !Array.isArray(funcInfo.events)) {
        continue;
      }

      for (const event of funcInfo.events) {
        const trigger = event?.http;
        if (!trigger) {
          continue;
        }

        // TODO * to 正则表达式
        const path = trigger.path || '/.*';
        vercelJson.routes.push({
          src: path,
          dest: entryFileName,
          methods: convertMethods(trigger.method),
        });
      }
    }

    writeFileSync(this.vercelJsonFile, JSON.stringify(vercelJson, null, 2));
  }

  // generate api/function.js
  async gengerateVercelEntry() {
    this.core.cli.log('Generate entry file...');
    this.setGlobalDependencies('@midwayjs/serverless-scf-starter');
    const apiDir = join(this.midwayBuildPath, 'api');
    await ensureDir(apiDir);

    // strip other trigger except http
    const functionList = this.getFunctionList();
    const functions = {};
    for (const func of functionList) {
      functions[func.funcName] = func.funcInfo;
    }

    writeWrapper({
      baseDir: this.servicePath,
      service: {
        ...this.core.service,
        functions,
      },
      distDir: apiDir,
      isDefaultFunc: true,
      skipInitializer: true,
      starter: '@midwayjs/serverless-scf-starter',
    });
  }

  // vercel deploy
  async vercelDeploy() {
    // 执行 package 打包
    await this.core.invoke(['package'], true, {
      ...this.options,
      skipZip: true, // 跳过压缩成zip
      skipInstallDep: true,
    });

    await this.safeRemoveUselessFile();

    this.core.cli.log('Start deploy by vercel/cli');
    try {
      this.core.cli.log('Deploy success');
    } catch (e) {
      this.core.cli.log(`Deploy error: ${e.message}`);
    }
  }

  // remove useless file
  async safeRemoveUselessFile() {
    const files = [
      'src',
      'f.origin.yml',
      'f.yml',
      'jest.config.js',
      'tsconfig.json',
      'dist/.mwcc-cache',
      'dist/midway-build.json',
    ];

    await Promise.all(
      files.map(async file => {
        if (existsSync(file)) {
          await remove(file);
        }
      })
    );

    const list = await globby(['**/*.d.ts', '**/*.ts.map', '**/*.js.map'], {
      cwd: join(this.midwayBuildPath, 'dist'),
      deep: 10,
    });

    for (const file of list) {
      const path = join(this.midwayBuildPath, 'dist', file);
      if (existsSync(path)) {
        await remove(path);
      }
    }
  }
}
