import { BasePlugin, resolveMidwayConfig } from '@midwayjs/command-core';
import { RunnerContainer, Runner } from '@midwayjs/luckyeye';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import * as chalk from 'chalk';
import * as YAML from 'js-yaml';
import { Locator, AnalyzeResult } from '@midwayjs/locate';
import { transformToRelative } from './utils';
import * as globby from 'globby';

enum ProjectType {
  FaaS = 'faas',
  MigrateToFaaS = 'migrateToFaaS',
}

const CHECK_SKIP = 'check_skip';

enum CHECK_COLOR {
  GROUP = '#e5e511',
  ERROR = '#f55111',
  SUCCESS = '#23d18b',
  SKIP = '#999999',
}

type RunnerItem = (runner: Runner) => void;

export class CheckPlugin extends BasePlugin {
  projectType: ProjectType;
  currentGroup: string;
  servicePath = this.core.config.servicePath;
  sourcesInfo: { code: string; file: string; tsSourceFile: string }[] = [];

  errors = [];

  commands = {
    check: {
      usage: 'find your code bugs',
      lifecycleEvents: ['start', 'check', 'output'],
    },
  };

  hooks = {
    'check:start': this.start.bind(this),
    'check:check': this.check.bind(this),
  };

  globalData: {
    cwd: string;
    projectType: ProjectType;
    tsCodeRoot: string;
    locateResult: AnalyzeResult;
  };

  pkg: any = {};

  isHooks = false;

  async start() {
    // check project type
    const fyml = this.getYamlFilePosition();
    if (existsSync(fyml)) {
      const yamlData = readFileSync(fyml).toString();
      if (!/deployType/.test(yamlData)) {
        this.projectType = ProjectType.FaaS;
      } else {
        // koa/express/egg 迁移
        this.projectType = ProjectType.MigrateToFaaS;
      }
    }
    const cwd = this.getCwd();
    let tsCodeRoot = join(cwd, 'src');
    let locateResult: AnalyzeResult;

    if (this.projectType === ProjectType.FaaS) {
      const locator = new Locator(cwd);
      // midway hooks 支持
      const config = resolveMidwayConfig(cwd);
      if (config.exist) {
        this.isHooks = true;
        this.options.sourceDir = config.source;
      }

      if (this.options.sourceDir) {
        this.options.sourceDir = transformToRelative(
          this.servicePath,
          this.options.sourceDir
        );
      }
      locateResult = await locator.run({
        tsCodeRoot:
          this.options.sourceDir &&
          join(this.servicePath, this.options.sourceDir),
      });
      tsCodeRoot = locateResult?.tsCodeRoot;
    }

    const pkgJsonFile = join(cwd, 'package.json');
    if (existsSync(pkgJsonFile)) {
      this.pkg = JSON.parse(readFileSync(pkgJsonFile).toString());
    }

    this.globalData = {
      cwd,
      projectType: this.projectType,
      tsCodeRoot,
      locateResult,
    };

    if (existsSync(tsCodeRoot)) {
      const tsSourceFileList = await globby(['**/*.ts'], {
        cwd: tsCodeRoot,
      });
      this.sourcesInfo = tsSourceFileList.map(tsSourceFile => {
        const file = join(tsCodeRoot, tsSourceFile);
        const code = readFileSync(file).toString();
        return {
          tsSourceFile,
          file,
          code,
        };
      });
    }

    this.setStore('checkGlobalData', this.globalData, true);
  }

  async check() {
    const container = new RunnerContainer();
    container.loadRulePackage();
    container.registerReport(this.getCheckReporter());
    const ruleList = await this.getRuleList();
    for (const rule of ruleList) {
      container.addRule(rule);
    }
    await container.run();
  }

  async getRuleList(): Promise<Array<RunnerItem>> {
    const ruleList: RunnerItem[] = [
      await this.projectStruct(),
      await this.packageJson(),
      await this.ruleIoc(),
    ];

    if (this.projectType === ProjectType.FaaS) {
      ruleList.push(this.ruleTSConfig(), await this.ruleFaaSDecorator());
    }

    if (
      this.projectType === ProjectType.FaaS ||
      this.projectType === ProjectType.MigrateToFaaS
    ) {
      ruleList.push(this.ruleFYaml());
    }

    const moreCheckRules = this.getStore('checkRules', 'global');
    if (moreCheckRules && Array.isArray(moreCheckRules)) {
      for (const getRule of moreCheckRules) {
        const rule = await getRule();
        ruleList.push(rule);
      }
    }
    return ruleList;
  }

  // package json 校验
  async packageJson(): Promise<RunnerItem> {
    const pkjJson = this.pkg;
    const pkgExists = !!Object.keys(this.pkg).length;
    return runner => {
      runner
        .group('package.json check')
        .check('exists', () => {
          if (!pkgExists) {
            return [false, 'not exist package.json'];
          }
          return [true];
        })
        .check('no cli deps', () => {
          if (!pkgExists) {
            return [true];
          }

          const deps = pkjJson['dependencies'] || {};
          const cliDeps = Object.keys(deps).filter(name => {
            if (name === '@midwayjs/cli') {
              return true;
            }
            if (name.includes('/fcli-plugin-')) {
              return true;
            }
            if (name.endsWith('/faas-cli')) {
              return true;
            }
            if (name.endsWith('/faas-fun')) {
              return true;
            }
            if (name.endsWith('/faas-invoke')) {
              return true;
            }
            if (name.includes('@midwayjs/cli-plugin-')) {
              return true;
            }
            if (name === '@midwayjs/serverless-app') {
              return true;
            }

            if (name === '@midwayjs/serverless-app') {
              return true;
            }

            if (name.startsWith('@serverless-devs/')) {
              return true;
            }

            if (name === '@alicloud/fun') {
              return true;
            }

            return false;
          });

          if (cliDeps.length) {
            return [
              false,
              'dependencies are not allowed to exist ' + cliDeps.join(', '),
            ];
          }

          return [true];
        });
    };
  }

  // 校验项目结构
  async projectStruct(): Promise<RunnerItem> {
    const cwd = this.getCwd();
    let tsCodeRootCheckPassed = true;
    return runner => {
      runner
        .group('project struct check')
        .check('node version', () => {
          const v = +process.version.split('.')[0].replace(/[^\d]/g, '');
          if (v < 12) {
            return [false, 'Node Version shoule >= Node 12'];
          }
          return [true];
        })
        .check('ts root', () => {
          if (!this.globalData.tsCodeRoot) {
            tsCodeRootCheckPassed = false;
            return [false, 'no tsCodeRoot, tsconfig.json may not exist'];
          }
          return [true];
        })
        .check('ts root should not be same to cwd', () => {
          if (this.globalData.tsCodeRoot === cwd) {
            tsCodeRootCheckPassed = false;
            return [
              false,
              'ts file should be in src directory, other ts directory should be configured in tsconfig.json exclude attribute',
            ];
          }
          return [true];
        })
        .check('project type', () => {
          if (
            !this.globalData.locateResult?.projectType ||
            this.globalData.locateResult.projectType === 'unknown'
          ) {
            return [false, 'can not check project type'];
          }
          return [true];
        })
        .check('config', () => {
          if (!tsCodeRootCheckPassed) {
            return [true];
          }
          const existsConfig = existsSync(
            join(this.globalData.tsCodeRoot, 'config')
          );

          const configuration = join(
            this.globalData.tsCodeRoot,
            'configuration.ts'
          );
          let configurationData;

          if (existsSync(configuration)) {
            configurationData = readFileSync(configuration).toString();
          }
          if (!existsConfig) {
            if (configurationData) {
              if (configurationData.includes('importConfigs')) {
                return [false, 'config directory is required'];
              }
            }

            return [true];
          }

          if (!configurationData) {
            return [false, 'config need to be set in configuration.ts'];
          }

          if (!configurationData.includes('importConfigs')) {
            return [false, 'config need to be set in configuration.ts'];
          }

          if (configurationData.includes('config/config.')) {
            return [
              false,
              "please use join(__dirname, './config/') to import config",
            ];
          }
          return [true];
        })
        .check('config file', () => {
          if (!tsCodeRootCheckPassed) {
            return [true];
          }
          const existsConfig = existsSync(
            join(this.globalData.tsCodeRoot, 'config')
          );
          if (!existsConfig) {
            return [true];
          }

          const configLocal = join(
            this.globalData.tsCodeRoot,
            'config/config.local.ts'
          );
          const configDaily = join(
            this.globalData.tsCodeRoot,
            'config/config.daily.ts'
          );

          const configProd = join(
            this.globalData.tsCodeRoot,
            'config/config.prod.ts'
          );

          const configDefault = join(
            this.globalData.tsCodeRoot,
            'config/config.default.ts'
          );

          if (existsSync(configDaily) && !existsSync(configLocal)) {
            return [false, 'only daily env config, can not run on local env'];
          }

          if (existsSync(configLocal) && !existsSync(configDaily)) {
            return [false, 'only local env config, can not run on daily env'];
          }

          if (!existsSync(configProd) && !existsSync(configDefault)) {
            return [false, 'no prod or default config'];
          }

          return [true];
        })
        .check('config export', () => {
          if (!tsCodeRootCheckPassed) {
            return [true];
          }
          const existsConfig = existsSync(
            join(this.globalData.tsCodeRoot, 'config')
          );
          if (!existsConfig) {
            return [true];
          }

          const configWithExportDefaultAndNamed = [
            'local',
            'daily',
            'pre',
            'prod',
            'default',
          ].filter(name => {
            const configFile = join(
              this.globalData.tsCodeRoot,
              `config/config.${name}.ts`
            );
            if (!existsSync(configFile)) {
              return;
            }
            const code = readFileSync(configFile).toString();
            return (
              code.includes('export const ') && code.includes('export default ')
            );
          });
          if (configWithExportDefaultAndNamed.length) {
            return [
              false,
              `default and named export cannot coexist in ${configWithExportDefaultAndNamed.join(
                ' and '
              )} environment config`,
            ];
          }
          return [true];
        })
        .check('config inject', () => {
          if (!tsCodeRootCheckPassed) {
            return [true];
          }
          // 注入的 config 检测
          const configInjectReg =
            /@config\(\s*(?:['"](\w+)['"])?\s*\)(?:\n|\s)*(\w+)(:|;|\n|\s)/gi;
          let execRes;
          const requiredConfigMap = {};
          for (const { code, tsSourceFile } of this.sourcesInfo) {
            while ((execRes = configInjectReg.exec(code))) {
              const configName = execRes[1] || execRes[2];
              if (configName) {
                requiredConfigMap[configName] = tsSourceFile;
              }
            }
          }
          const allConfigKey = Object.keys(requiredConfigMap);
          const allConfigContent = [
            'local',
            'daily',
            'pre',
            'prod',
            'default',
          ].map(env => {
            const configFile = join(
              this.globalData.tsCodeRoot,
              `config/config.${env}.ts`
            );
            if (!existsSync(configFile)) {
              return '';
            }
            return readFileSync(configFile).toString();
          });
          const notFindConfig = allConfigKey.filter(config => {
            const reg = new RegExp(`\\s${config}\\s*[=:]|\\.${config}\\s*[=:]`);
            return !allConfigContent.find(code => reg.test(code));
          });
          if (!notFindConfig.length) {
            return [true];
          }
          return [
            false,
            `config ${notFindConfig.join(
              ', '
            )} was been injected, but not define in config/config.$env.ts`,
          ];
        })
        .check('hooks import', () => {
          if (!this.isHooks) {
            return [true];
          }
          const configurationFile = join(
            this.globalData.tsCodeRoot,
            'configuration.ts'
          );
          if (!existsSync(configurationFile)) {
            return [false, 'midway hooks need configutation.ts'];
          }
          const configurationData = readFileSync(configurationFile).toString();
          if (!configurationData.includes('hooks(')) {
            return [false, 'Need add hooks() to configutation.ts imports list'];
          }
          return [true];
        });
    };
  }

  async ruleFaaSDecorator(): Promise<RunnerItem> {
    // 校验是否存在 decorator 重名
    // 校验 @Logger 装饰器所在class是否被继承
    return () => {};
  }

  // 校验yaml格式
  ruleFYaml(): RunnerItem {
    // yaml 配置
    const yamlFile = join(this.getCwd(), 'f.yml');
    let yamlObj;
    let error;
    try {
      const contents = readFileSync(yamlFile).toString();
      yamlObj = YAML.load(contents.toString(), {});
    } catch (exception) {
      error = exception;
    }
    return runner => {
      runner
        .group('f.yml check')
        .check('format', () => {
          if (error) {
            return [false, 'Yaml format error: ' + error.message];
          }
          return [true];
        })
        .check('service', () => {
          if (!yamlObj?.service) {
            return [false, 'Yaml should have service config'];
          }
          return [true];
        })
        .check('provider', () => {
          if (!yamlObj?.provider) {
            return [false, 'Yaml should have provider config'];
          }
          if (!yamlObj?.provider?.name) {
            return [
              false,
              'Yaml should have provider.name config, e.g. aliyun',
            ];
          }
          return [true];
        })
        .check('trigger list', () => {
          if (!yamlObj?.functions) {
            return [CHECK_SKIP];
          }

          const allFunc = Object.keys(yamlObj.functions);
          for (const funcName of allFunc) {
            const funcInfo = yamlObj.functions[funcName];
            // 允许无触发器配置
            if (!funcInfo.events) {
              continue;
            }
            if (!Array.isArray(funcInfo.events)) {
              return [
                false,
                `function '${funcName}' events type should be Array`,
              ];
            }
          }
          return [true];
        })
        .check('http trigger', () => {
          if (!yamlObj?.functions) {
            return [CHECK_SKIP];
          }

          const allFunc = Object.keys(yamlObj.functions);
          for (const funcName of allFunc) {
            const funcInfo = yamlObj.functions[funcName];
            if (!funcInfo.events || !Array.isArray(funcInfo.events)) {
              continue;
            }
            const httpTriggers = funcInfo.events.filter(event => {
              return event?.http || event?.apigw;
            });

            if (!httpTriggers.length) {
              continue;
            }

            for (const httpTrigger of httpTriggers) {
              const triggerInfo = httpTrigger.http || httpTrigger.apigw;
              if (!triggerInfo.path) {
                return [
                  false,
                  `function '${funcName}' http.trigger need path attribute`,
                ];
              }
              if (triggerInfo.method && !Array.isArray(triggerInfo.method)) {
                return [
                  false,
                  `function '${funcName}' http.trigger.method type should be Array`,
                ];
              }
            }
          }
          return [true];
        })
        .check('package in/exclude type', () => {
          if (!yamlObj?.package) {
            return [CHECK_SKIP];
          }

          if (
            yamlObj.package.include &&
            !Array.isArray(yamlObj.package.include)
          ) {
            return [false, 'YAML package.include type should be Array'];
          }

          if (
            yamlObj.package.exclude &&
            !Array.isArray(yamlObj.package.exclude)
          ) {
            return [false, 'YAML package.exclude type should be Array'];
          }
          return [true];
        })
        .check('deployType', () => {
          const deps = this.pkg.dependencies || {};

          const deployType =
            typeof yamlObj.deployType === 'string'
              ? yamlObj.deployType
              : yamlObj.deployType?.type;

          if (deps['@midwayjs/faas'] || deps['@ali/midway-faas']) {
            if (deployType) {
              return [
                false,
                'faas does not allow the deployType to be configured in the f.yml file',
              ];
            }
          }

          if ((deps['@midwayjs/koa'] || deps['koa']) && deployType !== 'koa') {
            return [
              false,
              'Deploying koa as FAAS requires configuring the deployType as koa in the f.yml file',
            ];
          }

          if (
            (deps['@midwayjs/express'] || deps['express']) &&
            deployType !== 'express'
          ) {
            return [
              false,
              'Deploying express as FAAS requires configuring the deployType as express in the f.yml file',
            ];
          }

          if ((deps['@midwayjs/web'] || deps['egg']) && deployType !== 'egg') {
            return [
              false,
              'Deploying egg as FAAS requires configuring the deployType as egg in the f.yml file',
            ];
          }

          return [true];
        });
    };
  }

  ruleTSConfig(): RunnerItem {
    const tsConfigFile = join(this.getCwd(), 'tsconfig.json');
    const exists = existsSync(tsConfigFile);
    let tsconfig;
    return runner => {
      runner
        .group('tsconfig check')
        .check('exists', () => {
          if (!exists) {
            return [false, 'tsconfig.json not exists'];
          }
          return [true];
        })
        .check('parse', () => {
          if (!exists) {
            return [CHECK_SKIP];
          }
          try {
            tsconfig = JSON.parse(readFileSync(tsConfigFile).toString());
          } catch (e) {
            return [false, 'tsconfig parse error: ' + e.message];
          }
          return [true];
        })
        .check('compiler target', () => {
          const target = tsconfig?.compilerOptions?.target;
          if (!target) {
            return [CHECK_SKIP];
          }
          const targetMap = {
            es3: 3,
            es5: 5,
            es6: 6,
            es7: 7,
            es2015: 6,
            es2016: 7,
            es2017: 8,
            es2018: 9,
            es2019: 10,
            es2020: 11,
            es2021: 12,
            esnext: 12,
          };
          const targetVersion =
            targetMap[target.toLowerCase().replace(/\s+/g, '')];
          if (!targetVersion) {
            return [
              false,
              `tsconfig target version(${targetVersion}) is not supported`,
            ];
          } else if (targetVersion > 9) {
            return [false, 'tsconfig target need ≤ es2018'];
          }
          return [true];
        })
        .check('emitDecoratorMetadata', () => {
          const emitDecoratorMetadata =
            tsconfig?.compilerOptions?.emitDecoratorMetadata;
          if (!emitDecoratorMetadata) {
            return [false, 'tsconfig emitDecoratorMetadata need true'];
          }
          return [true];
        });
    };
  }

  async ruleIoc() {
    return runner => {
      runner.group('ioc check').check('class define', async () => {
        const classNameMap = {};
        for (const { code, tsSourceFile } of this.sourcesInfo) {
          // @Provider() export default class xxx extends xxx {}
          const reg =
            /@(?:provider|controller)\([^)]*\)(?:\n|\s)*(export)?(\s+default\s+)?\s*class\s+(.*?)\s+/gi;

          let execRes;
          while ((execRes = reg.exec(code))) {
            const className = execRes[3];
            // export
            if (!execRes[1]) {
              return [
                false,
                `class ${className} need export in ${tsSourceFile}`,
              ];
            }

            // export default
            if (execRes[2]) {
              return [
                false,
                `class ${className} can not export "default" in ${tsSourceFile}`,
              ];
            }

            if (classNameMap[className]) {
              return [
                false,
                `there is a duplicate class name(${className}) in ${classNameMap[className]} and ${tsSourceFile}`,
              ];
            }
            classNameMap[className] = tsSourceFile;
          }
        }
        return [true];
      });
    };
  }

  private getCheckReporter() {
    return {
      reportGroup: data => {
        this.currentGroup = data.group;
        this.checkReporterOutput();
        this.checkReporterOutput({
          msg: data.group,
          prefix: '◎',
          color: CHECK_COLOR.GROUP,
        });
        this.checkReporterOutput();
      },
      reportCheck: data => {
        if (data.message === CHECK_SKIP) {
          this.core.debug('skip check', this.currentGroup, data.title);
        } else if (data.message) {
          this.checkReporterOutput({
            msg: data.title,
            prefix: '✔',
            color: CHECK_COLOR.SUCCESS,
            ident: 1,
          });
        } else {
          this.errors.push({
            group: this.currentGroup,
            title: data.title,
            message: data.result,
          });
          this.checkReporterOutput({
            msg: data.title,
            prefix: '✗',
            color: CHECK_COLOR.ERROR,
            ident: 1,
          });
        }
      },
      reportEnd: () => {
        if (this.errors.length) {
          this.checkReporterOutput();
          this.checkReporterOutput({
            msg: 'Check Not Passed:',
            color: CHECK_COLOR.ERROR,
          });
          let i = 1;
          for (const error of this.errors) {
            this.checkReporterOutput({
              msg: `${i++}. ${error.message} [ ${error.group} ]`,
              color: CHECK_COLOR.ERROR,
              ident: 1,
            });
          }
        } else {
          this.checkReporterOutput();
          this.checkReporterOutput({
            msg: 'All Check Passed',
            color: CHECK_COLOR.SUCCESS,
          });
        }
      },
      reportStart: () => {},
      reportInfo: () => {},
      reportSkip: () => {},
    };
  }

  private checkReporterOutput(
    message?:
      | string
      | { msg: string; color?: CHECK_COLOR; prefix?: string; ident?: number }
  ) {
    if (!message) {
      message = {
        msg: '',
      };
    } else if (typeof message === 'string') {
      message = {
        msg: message,
      };
    }

    let msg = message.msg || '';

    if (message.prefix) {
      msg = message.prefix + ' ' + msg;
    }

    if (message.ident) {
      msg = Array(message.ident).fill(' ').join(' ') + msg;
    }
    if (message.color) {
      msg = chalk.hex(message.color)(msg);
    }

    this.core.cli.log(msg);
  }

  private getYamlFilePosition() {
    return join(this.getCwd(), 'f.yml');
  }

  private getCwd() {
    return this.servicePath || this.core.cwd || process.cwd();
  }
}
