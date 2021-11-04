import { BasePlugin, ICoreInstance } from '@midwayjs/command-core';
import * as AliyunDeploy from '@alicloud/fun/lib/commands/deploy';
import * as AliyunConfig from '@alicloud/fun/lib/commands/config';
import { loadComponent, setCredential } from '@serverless-devs/core';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, writeFileSync, ensureDir } from 'fs-extra';
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

      const preloadFile = this.getStore('preloadFile', 'global');

      writeWrapper({
        baseDir: this.servicePath,
        service: this.core.service,
        distDir: this.midwayBuildPath,
        starter: '@midwayjs/serverless-fc-starter',
        preloadFile,
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
        if (
          process.env.SERVERLESS_DEPLOY_ID &&
          process.env.SERVERLESS_DEPLOY_AK &&
          process.env.SERVERLESS_DEPLOY_SECRET
        ) {
          // for ci
          const profDir = join(homedir(), '.fcli');
          if (!existsSync(profDir)) {
            mkdirSync(profDir);
          }
          const endPoint =
            process.env.SERVERLESS_DEPLOY_ENDPOINT || 'cn-hangzhou';
          const config = [
            `endpoint: 'https://${process.env.SERVERLESS_DEPLOY_ID}.${endPoint}.fc.aliyuncs.com'`,
            "api_version: '2016-08-15'",
            `access_key_id: ${process.env.SERVERLESS_DEPLOY_AK}`,
            `access_key_secret: ${process.env.SERVERLESS_DEPLOY_SECRET}`,
            "security_token: ''",
            'debug: false',
            `timeout: ${process.env.SERVERLESS_DEPLOY_TIMEOUT || 1000}`,
            'retries: 3',
            `sls_endpoint: ${endPoint}.log.aliyuncs.com`,
            'report: true',
            'enable_custom_endpoint: false',
          ].join('\n');
          writeFileSync(profPath, config);
        } else {
          this.core.cli.log('please input aliyun config');
          await AliyunConfig();
        }
      }

      // 执行 package 打包
      await this.core.invoke(['package'], true, {
        ...this.options,
        skipZip: true, // 跳过压缩成zip
      });
      this.core.cli.log('Start deploy by @alicloud/fun');
      try {
        if (!this.options.skipDeploy) {
          await AliyunDeploy({
            template: join(this.midwayBuildPath, 'template.yml'),
            assumeYes: this.options.yes,
          });
        }
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
      functions: this.core.service.functions,
      resources: service.resources,
      package: service.package,
    };
  }

  async deployUseServerlessDev() {
    const profDirPath = join(homedir(), '.s');
    await ensureDir(profDirPath);
    const profPath = join(profDirPath, 'access.yaml');
    const isExists = existsSync(profPath);
    if (!isExists || this.options.resetConfig) {
      // aliyun config
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
    let fcDeploy;
    if (!this.options.skipDeploy) {
      // https://github.com/devsapp/fc-deploy/
      fcDeploy = await loadComponent('fc-deploy');
    }
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
        Object.assign(fcDeployInputs, this.options.serverlessDev);
        delete fcDeployInputs.access;
        fcDeployInputs.path = { configPath: this.midwayBuildPath };
        fcDeployInputs.props.function.codeUri = this.midwayBuildPath;
        if (!this.options.skipDeploy) {
          await fcDeploy.deploy(fcDeployInputs);
        }
        const funcName = fcDeployInputs.props.function.name;
        this.core.cli.log(`Function '${funcName}' deploy success`);
      }
    } catch (e) {
      this.core.cli.log(`Deploy error: ${e.message}`);
    }
    process.chdir(cwd);
  }
}
