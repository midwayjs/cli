import {
  BasePlugin,
  findNpmModule,
  formatModuleVersion,
} from '@midwayjs/command-core';
import { existsSync, readdir, readFileSync, stat } from 'fs-extra';
import { join, resolve } from 'path';
import { envConfigFileReg, MidwayFramework, midwayFrameworkInfo } from './constants';
import { IConfigurationInfo, IProjectInfo } from './interface';
import * as YAML from 'js-yaml';
import { ASTOperator, IFileAstInfo } from './ast';
import * as ts from 'typescript';
import { astToValue, AST_VALUE_TYPE, createAstValue, IValueDefine, valueToAst } from './astUtils';
const factory = ts.factory;

export class UpgradePlugin extends BasePlugin {
  canUpgrade = false;
  astInstance: ASTOperator;

  projectInfo: IProjectInfo = {
    cwd: process.cwd(),
    pkg: {
      file: '',
      data: {},
    },
    serverlessYml: {
      file: '',
      data: {},
    },
    framework: MidwayFramework.Unknown,
    withServerlessYml: false,
    midwayTsSourceRoot: '',
  };

  commands = {
    upgrade: {
      usage: 'upgrade to new version',
      lifecycleEvents: ['projectInfo', 'framework'],
    },
  };

  hooks = {
    'upgrade:projectInfo': this.getProjectInfo.bind(this),
    'upgrade:framework': this.handleFrameworkUpgrade.bind(this),
  };

  async getProjectInfo() {
    const cwd = (this.projectInfo.cwd = this.getCwd());
    const pkgFile = join(process.cwd(), 'package.json');
    if (!pkgFile) {
      return;
    }

    this.astInstance = new ASTOperator();

    const pkgJson = JSON.parse(readFileSync(pkgFile, 'utf-8'));
    this.projectInfo.pkg = {
      file: pkgFile,
      data: pkgJson,
    };

    const framework = midwayFrameworkInfo.find(frameworkInfo => {
      const version = this.getModuleVersion(
        frameworkInfo.module
      );
      this.projectInfo.frameworkInfo = {
        info: frameworkInfo,
        version,
      }
      return this.projectInfo.frameworkInfo;
    });

    if (!framework) {
      return;
    }

    this.projectInfo.framework = framework.type;
    const yamlFile = join(cwd, 'f.yml');
    this.projectInfo.withServerlessYml = existsSync(yamlFile);

    if (this.projectInfo.withServerlessYml) {
      const contents = readFileSync(yamlFile).toString();
      this.projectInfo.serverlessYml = {
        file: yamlFile,
        data: YAML.load(contents.toString(), {}),
      };
    }

    // midway hooks 支持
    const midwayConfig = [
      join(cwd, 'midway.config.ts'),
      join(cwd, 'midway.config.js'),
    ].find(file => existsSync(file));
    if (midwayConfig) {
      const modInfo =
        findNpmModule(cwd, '@midwayjs/hooks/internal') ||
        findNpmModule(cwd, '@midwayjs/hooks-core');
      if (modInfo) {
        const { getConfig } = require(modInfo);
        const config = getConfig(cwd);
        if (config.source) {
          this.projectInfo.midwayTsSourceRoot = config.source;
        }
      }
      this.projectInfo.hooksInfo = this.getModuleVersion(modInfo);
    } else {
      this.projectInfo.hooksInfo = ['@midwayjs/hooks']
        .map(moduleName => {
          return this.getModuleVersion(moduleName);
        })
        .find(versionInfo => !!versionInfo);
    }

    this.projectInfo.intergrationInfo =
      existsSync(join(cwd, 'src/apis')) &&
      ['react', 'rax']
        .map(moduleName => {
          return this.getModuleVersion(moduleName);
        })
        .find(versionInfo => !!versionInfo);

    if (!this.projectInfo.midwayTsSourceRoot) {
      this.projectInfo.midwayTsSourceRoot = join(cwd, 'src');
      if (this.projectInfo.intergrationInfo) {
        this.projectInfo.midwayTsSourceRoot = join(cwd, 'src/apis');
      }
    }
    this.core.debug('projectInfo', this.projectInfo);
  }


  async handleFrameworkUpgrade() {
    // 2 升级 3
    if (this.projectInfo.frameworkInfo.version.major === '2') {
      await this.handleConfiguration2To3();
      const pkgJson = this.projectInfo.pkg.data;
      pkgJson.dependencies[this.projectInfo.frameworkInfo.info.module] = '^3.0.0';
      const notNeedUpgreade = ['@midwayjs/logger'];
      Object.keys(pkgJson.dependencies).map(depName => {
        if (depName.startsWith('@midwayjs/') || notNeedUpgreade.includes(depName) || depName.includes('cli')) {
          return;
        }
        pkgJson.dependencies[depName] = '^3.0.0';
      });

      Object.keys(pkgJson.devDependencies).map(depName => {
        if (depName.startsWith('@midwayjs/') || notNeedUpgreade.includes(depName) || depName.includes('cli')) {
          return;
        }
        pkgJson.devDependencies[depName] = '^3.0.0';
      });

      switch(this.projectInfo.framework) {
        case MidwayFramework.FaaS:
          await this.faas2To3();
          break;
      }
      this.canUpgrade = true;
      return;
    }
  }


  async final() {
    if (!this.canUpgrade) {
      const { version } = this.projectInfo.frameworkInfo;
      return this.core.cli.log(`The current framework version (${MidwayFramework.FaaS} ${version.major}.${version.minor}) does not support upgrading`);
    }
  }

  // 升级 configuration 从2版本到3版本
  async handleConfiguration2To3() {
    const { frameworkInfo, midwayTsSourceRoot } = this.projectInfo;
    const configurationInfo = this.getConfiguration();
    const  { astInfo } = configurationInfo;

    // 添加框架依赖
    const frameworkName = frameworkInfo.info.type + 'Framework';
    this.astInstance.addImportToFile(astInfo, {
      moduleName: frameworkInfo.info.module,
      name: frameworkName,
      isNameSpace: true,
    });

    // 添加到 configuration 的 imports 中
    await this.setConfigurationDecorator('imports', [
      { type: AST_VALUE_TYPE.Identifier, value: frameworkName }
    ], false, configurationInfo);


    const envConfigFilesDir = join(midwayTsSourceRoot, 'config');
    const configProps: ts.ObjectLiteralElementLike[] = [];
    if (existsSync(envConfigFilesDir)) {
      const configFileDir = await stat(envConfigFilesDir);
      if (configFileDir.isDirectory()) {
        const allFiles = await readdir(envConfigFilesDir);
        allFiles.forEach(file => {
          if (envConfigFileReg.test(file)) {
            const env = envConfigFileReg.exec(file)[1];
            const envVarName = env + 'Config';
            // import 到 configuration 文件中
            this.astInstance.addImportToFile(astInfo, {
              moduleName: `./config/config.${env}`,
              name: envVarName,
              isNameSpace: true,
            });
            configProps.push(factory.createPropertyAssignment(
              factory.createIdentifier(env),
              factory.createIdentifier(env + 'Config'),
            ));
          }
        });
      }
    }
    // 把 config 进行替换
    // 移除老的
    await this.setConfigurationDecorator('importConfigs', [], true, configurationInfo);
    // 添加新的
    await this.setConfigurationDecorator('importConfigs', [{
      type: AST_VALUE_TYPE.AST,
      value: factory.createObjectLiteralExpression(configProps)
    }], false, configurationInfo);
  }

 

  async faas2To3() {
    const pkgJson = this.projectInfo.pkg.data;
    
    delete pkgJson.dependencies['@midwayjs/serverless-app'];

    pkgJson.devDependencies['@midwayjs/serverless-app'] = '^3.0.0';

    const provider = this.projectInfo.serverlessYml?.data?.provider?.name;

    if (provider === 'aliyun' || provider === 'fc') {
      pkgJson.devDependencies['@midwayjs/serverless-fc-starter'] = '^3.0.0';
      pkgJson.devDependencies['@midwayjs/serverless-fc-trigger'] = '^3.0.0';
    } else if (provider === 'scf') {
      pkgJson.devDependencies['@midwayjs/serverless-scf-starter'] = '^3.0.0';
      pkgJson.devDependencies['@midwayjs/serverless-scf-trigger'] = '^3.0.0';
    }
  }

  private getCwd() {
    return this.core.config?.servicePath || this.core.cwd || process.cwd();
  }

  private getModuleVersion(moduleName: string) {
    const pkgJson = this.projectInfo.pkg.data as any;
    const cwd = this.projectInfo.cwd;
    if (existsSync(join(cwd, 'node_modules'))) {
      try {
        const modulePkgJson = require.resolve(moduleName + '/package.json', {
          paths: [cwd],
        });
        const pkg = JSON.parse(readFileSync(modulePkgJson, 'utf-8'));
        return formatModuleVersion(pkg.version);
      } catch {
        //
      }
    }
    const version =
      pkgJson.dependencies?.[moduleName] ||
      pkgJson.devDependencies?.[moduleName];
    if (!version) {
      return;
    }
    return formatModuleVersion(version);
  }


  private getConfiguration(): IConfigurationInfo {
    const { midwayTsSourceRoot } = this.projectInfo;
    // 确保存在
    const configurationFilePath = resolve(midwayTsSourceRoot, 'configuration.ts');
    let configurationAstInfo: IFileAstInfo;
    if (existsSync(configurationFilePath)) {
      const configurationAstList = this.astInstance.getAstByFile(configurationFilePath);
      configurationAstInfo = configurationAstList[0];
    } else {
      configurationAstInfo = {
        file: ts.createSourceFile(configurationFilePath, '', ts.ScriptTarget.ES2018),
        fileName: configurationFilePath,
        changed: true
      };
      this.astInstance.setCache(configurationFilePath, [configurationAstInfo])
    }
    
    let configurationClass = configurationAstInfo.file.statements.find(statement => {
      return statement.kind === ts.SyntaxKind.ClassDeclaration && statement.decorators.find(decorator => {
        return (decorator.expression as any)?.expression?.escapedText === 'Configuration';
      });
    });

    let configurationFunc = configurationAstInfo.file.statements.find(statement => {
      return statement.kind === ts.SyntaxKind.ExportAssignment && (statement as any)?.expression?.expression?.escapedText === 'createConfiguration';
    });
    
    if (!configurationClass) {
      if (!configurationFunc) {
        configurationClass = factory.createClassDeclaration(
          [factory.createDecorator(factory.createCallExpression(
            factory.createIdentifier("Configuration"),
            undefined,
            [factory.createObjectLiteralExpression(
              [
                factory.createPropertyAssignment(
                  factory.createIdentifier("imports"),
                  factory.createArrayLiteralExpression(
                    [],
                    false
                  )
                ),
                factory.createPropertyAssignment(
                  factory.createIdentifier("importConfigs"),
                  factory.createArrayLiteralExpression(
                    [],
                    false
                  )
                )
              ],
              true
            )]
          ))],
          [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          factory.createIdentifier("AutoConfiguraion"),
          undefined,
          undefined,
          []
        );

        (configurationAstInfo.file as any).statements = configurationAstInfo.file.statements.concat(configurationClass);
        configurationAstInfo.changed = true;
        this.astInstance.addImportToFile(configurationAstInfo, {
          moduleName: '@midwayjs/decorator',
          name: ['Configuration'],
        });
      }
    }

    return {
      astInfo: configurationAstInfo,
      class: configurationClass as unknown as ts.ClassDeclaration,
      func: (configurationFunc as ts.ExportAssignment)?.expression as unknown as ts.CallExpression,
    };
  }

  // 设置 configuration 的装饰器中的 属性
  public setConfigurationDecorator(paramKey: string, values: IValueDefine[], isRemove?: boolean, configurationInfo?: IConfigurationInfo) {
    if (!configurationInfo) {
      configurationInfo = this.getConfiguration();
    }
    let argObj;
    if (configurationInfo.class) {
      const { decorators } = configurationInfo.class
      const decorator = decorators.find(decorator => {
        return (decorator.expression as any)?.expression?.escapedText === 'Configuration';
      })
      // 装饰器参数
      const args = (decorator.expression as any).arguments;
      if (!args.length) {
        args.push(ts.createObjectLiteral([], true));
      }
      argObj = args[0];
    } else if (configurationInfo.func) {
      argObj = configurationInfo.func.arguments[0];
    } else {
      return;
    }
    
    let findParam = argObj.properties.find((property) => {
      return property?.name?.escapedText === paramKey;
    });
    // 如果没有对应的值
    if (!findParam) {
      findParam = ts.createPropertyAssignment(
        ts.createIdentifier(paramKey),
        createAstValue([]),
      );
      argObj.properties.push(findParam);
    }

    // 如果值是数组
    const current = findParam.initializer.elements.map((element) => {
      return astToValue(element);
    });
    
    let newElementList = [] 
    if (isRemove) {
      if (values.length) {
        current.forEach(element => {
          const exists = values.find(value => {
            return value.type === element.type && value.value === element.value;
          })
          if (exists) {
            return;
          }
          newElementList.push(element);
        });
      }
    } else {
      newElementList = current;
      values.forEach(element => {
        const exists = newElementList.find(value => {
          return value.type === element.type && value.value === element.value;
        })
        if (exists) {
          return;
        }
        newElementList.push(element);
      });
    }
    findParam.initializer.elements = newElementList.map((element) => {
      return valueToAst(element);
    });
    const configurationFilePath = resolve(this.projectInfo.midwayTsSourceRoot, 'configuration.ts');
    this.astInstance.setAstFileChanged(configurationFilePath);
  }
}
