import { BasePlugin, ICoreInstance } from '@midwayjs/command-core';
import * as AliyunDeploy from '@alicloud/fun/lib/commands/deploy';
import * as AliyunConfig from '@alicloud/fun/lib/commands/config';
import { loadComponent, setCredential } from '@serverless-devs/core';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync } from 'fs';
import { writeWrapper } from '@midwayjs/serverless-spec-builder';
import {
  generateFunctionsSpecFile,
  generateComponentSpec,
} from '@midwayjs/serverless-spec-builder/fc';
export class AliyunFCPlugin extends BasePlugin {
  core: ICoreInstance;
  options: any;
  provider = 'aliyun';
  servicePath = this.core.config.servicePath;
  midwayBuildPath = join(this.servicePath, '.serverless');

  hooks = {
    'package:generateSpec': async () => {
      this.core.cli.log('Generate spec file...');
      await generateFunctionsSpecFile(
        this.getSpecJson(),
        join(this.midwayBuildPath, 'template.yml')
      );
    },
    'package:generateEntry': async () => {
      this.core.cli.log('Generate entry file...');
      this.setGlobalDependencies('@midwayjs/serverless-fc-starter');
      writeWrapper({
        baseDir: this.servicePath,
        service: this.core.service,
        distDir: this.midwayBuildPath,
        starter: '@midwayjs/serverless-fc-starter',
      });
    },
    'deploy:deploy': async () => {
      if (this.options.serverlessDev) {
        return this.deployUseServerlessDev();
      }
      const profPath = join(homedir(), '.fcli/config.yaml');
      const isExists = existsSync(profPath);
      if (!isExists || this.options.resetConfig) {
        // aliyun config
        this.core.cli.log('please input aliyun config');
        await AliyunConfig();
      }

      // 执行 package 打包
      await this.core.invoke(['package'], true, {
        ...this.options,
        skipZip: true, // 跳过压缩成zip
      });
      this.core.cli.log('Start deploy by @alicloud/fun');
      try {
        await AliyunDeploy({
          template: join(this.midwayBuildPath, 'template.yml'),
          assumeYes: this.options.yes,
        });
        this.core.cli.log('Deploy success');
      } catch (e) {
        this.core.cli.log(`Deploy error: ${e.message}`);
      }
    },
  };

  getSpecJson() {
    const service = this.core.service;
    return {
      custom: service.custom,
      service: service.service,
      provider: service.provider,
      functions: this.getNotIgnoreFunc(),
      resources: service.resources,
      package: service.package,
    };
  }

  // 获取没有忽略的方法（for 高密度部署）
  getNotIgnoreFunc() {
    const func = {};
    for (const funcName in this.core.service.functions) {
      const funcConf = this.core.service.functions[funcName];
      if (funcConf._ignore) {
        continue;
      }
      func[funcName] = funcConf;
    }
    return func;
  }

  async deployUseServerlessDev() {
    const profDirPath = join(homedir(), '.s');
    if (!existsSync(profDirPath)) {
      mkdirSync(profDirPath);
    }
    const profPath = join(profDirPath, 'access.yaml');
    const isExists = existsSync(profPath);
    if (!isExists || this.options.resetConfig) {
      // aliyun config
      this.core.cli.log('please input serverless-dev config');
      await setCredential();
    }
    // 执行 package 打包
    await this.core.invoke(['package'], true, {
      ...this.options,
      skipZip: true, // 跳过压缩成zip
    });
    this.core.cli.log('Start deploy by serverless-dev');

    const cwd = process.cwd();
    process.chdir(this.midwayBuildPath);
    const fcDeploy = await loadComponent('fc-deploy');
    if (!this.core.service) {
      this.core.service = {};
    }
    if (!this.core.service.provider) {
      this.core.service.provider = {};
    }
    if (typeof this.options.serverlessDev === 'object') {
      Object.assign(this.core.service.provider, this.options.serverlessDev);
    }
    const functions = generateComponentSpec(this.core.service);
    try {
      for (const fcDeployInputs of functions) {
        await fcDeploy.deploy(fcDeployInputs);
        const funcName = fcDeployInputs.properties.function.name;
        this.core.cli.log(`Function '${funcName}' deploy success`);
      }
    } catch (e) {
      this.core.cli.log(`Deploy error: ${e.message}`);
    }
    process.chdir(cwd);
  }
}
