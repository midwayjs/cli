import { BasePlugin, ICoreInstance } from '@midwayjs/command-core';
import { loadComponent, setCredential } from '@serverless-devs/core';
import { join } from 'path';
import { homedir } from 'os';
import * as YAML from 'js-yaml';
import { existsSync, ensureDir, mkdirSync } from 'fs-extra';
import { writeWrapper } from '@midwayjs/serverless-spec-builder';
import {
  generateFunctionsSpecFile,
  generateComponentSpec,
} from '@midwayjs/serverless-spec-builder/fc';
import { readFileSync, writeFileSync } from 'fs';
const Crypto = require('crypto-js');
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
      if (!this.options.useFun) {
        return this.deployUseServerlessDev();
      }

      let AliyunDeploy;
      try {
        AliyunDeploy = require('@alicloud/fun/lib/commands/deploy');
      } catch {
        console.error(
          '阿里云 FC 发布默认使用 @serverless/devs，若要继续使用 funcraft 发布，请手动安装 @alicloud/fun 依赖'
        );
        throw new Error('-- 请手动安装 @alicloud/fun 依赖 --');
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
          const AliyunConfig = require('@alicloud/fun/lib/commands/config');
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

  encode(value: string) {
    // ref: https://github.com/Serverless-Devs/core/blob/master/src/common/credential/setCredential.ts#L74
    return Crypto.AES.encrypt(value, 'SecretKey123').toString();
  }

  async deployUseServerlessDev() {
    const profDirPath = join(homedir(), '.s');
    await ensureDir(profDirPath);
    const profPath = join(profDirPath, 'access.yaml');
    let isExists = existsSync(profPath);
    let defaultRegion = process.env.SERVERLESS_DEPLOY_ENDPOINT || 'cn-hangzhou';
    let sDefaultYaml;
    let access = this.options.access || 'default';

    const funcraftConfigPath = join(homedir(), '.fcli/config.yaml');

    if (
      process.env.SERVERLESS_DEPLOY_ID &&
      process.env.SERVERLESS_DEPLOY_AK &&
      process.env.SERVERLESS_DEPLOY_SECRET
    ) {
      sDefaultYaml = {
        AccountID: this.encode(process.env.SERVERLESS_DEPLOY_ID),
        AccessKeyID: this.encode(process.env.SERVERLESS_DEPLOY_AK),
        AccessKeySecret: this.encode(process.env.SERVERLESS_DEPLOY_SECRET),
      };
      isExists = false;
    } else if (existsSync(funcraftConfigPath)) {
      const yamlContent = readFileSync(funcraftConfigPath).toString();
      const yaml: any = YAML.load(yamlContent);
      const endpointInfo = yaml.endpoint
        .replace(/^https:\/\/|fc\.aliyuncs\.com/g, '')
        .split('.');
      defaultRegion = endpointInfo[1];
      sDefaultYaml = {
        AccountID: this.encode(endpointInfo[0]),
        AccessKeyID: this.encode(yaml.access_key_id),
        AccessKeySecret: this.encode(yaml.access_key_secret),
      };
    }

    if (!isExists) {
      if (sDefaultYaml) {
        const syaml = {
          [access]: sDefaultYaml,
        };
        const text = YAML.dump(syaml, {
          skipInvalid: true,
        });
        writeFileSync(profPath, text);
        isExists = true;
      }
    }

    if (!isExists || this.options.resetConfig) {
      // aliyun config
      await setCredential();
    }

    const syaml: any = YAML.load(readFileSync(profPath).toString());
    if (!syaml[access]) {
      access = Object.keys(syaml)[0] || access;
    }
    // 执行 package 打包
    await this.core.invoke(['package'], true, {
      ...this.options,
    });

    const artifactFile =
      this.getStore('artifactFile', 'global') ||
      join(this.servicePath, 'serverless.zip');
    this.core.cli.log('');
    this.core.cli.log('Start deploy by @serverless-devs');
    this.core.cli.log('');

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

    const region = this.core.service.provider.region || defaultRegion;

    if (!this.options.serverlessDev) {
      this.options.serverlessDev = {
        access,
        region,
      };
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
        fcDeployInputs.props.function.codeUri = artifactFile;
        if (!this.options.skipDeploy) {
          const args = [];
          if (!this.options.useRemoteConfig) {
            args.push('--use-local');
          }
          if (this.options.yes) {
            args.push('--assume-yes');
          }
          fcDeployInputs.args = args.join(' ');
          await fcDeploy.deploy(fcDeployInputs);
        }
        const funcName = fcDeployInputs.props.function.name;

        if (fcDeployInputs?.props?.customDomains?.[0]?.domainName === 'auto') {
          const akId = Crypto.AES.decrypt(
            syaml[access].AccountID,
            'SecretKey123'
          ).toString(Crypto.enc.Utf8);
          this.core.cli.log('');
          for (const functionDomainInfo of fcDeployInputs.props.customDomains) {
            if (
              functionDomainInfo.domainName === 'auto' &&
              functionDomainInfo.routeConfigs?.length
            ) {
              for (const router of functionDomainInfo.routeConfigs) {
                this.core.cli.log(
                  `Auto Domain: http://${router.functionName}.${
                    router.serviceName
                  }.${akId}.${region}.fc.devsapp.net/${(
                    router.path || ''
                  ).replace(/^\/|\*+$/g, '')}`
                );
              }
            }
          }
        }

        this.core.cli.log('');
        this.core.cli.log(`Function '${funcName}' deploy success`);
      }
    } catch (e) {
      this.core.cli.log(`Deploy error: ${e.message}`);
    }
    process.chdir(cwd);
  }
}
