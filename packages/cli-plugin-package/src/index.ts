import {
  BasePlugin,
  findMidwayVersion,
  installNpm,
  resolveMidwayConfig,
  copyFiles,
  copyStaticFiles,
  exists,
  readJson,
  compileTypeScript,
} from '@midwayjs/command-core';
import { getSpecFile, writeToSpec } from '@midwayjs/serverless-spec-builder';
import {
  copy,
  ensureDir,
  ensureFile,
  existsSync,
  move,
  remove,
  statSync,
  writeFileSync,
} from 'fs-extra';
import { AnalyzeResult, Locator } from '@midwayjs/locate';
import { isAbsolute, join, relative, resolve } from 'path';
import {
  analysisDecorator,
  DefaultLockFiles,
  removeUselessFiles,
  transformPathToAbsolute,
  transformPathToRelative,
} from './utils';

import { aggregation } from './aggregation';
import { biggestDep, copyFromNodeModules } from './nodeModule';
import { makeZip } from './zip';

export class PackagePlugin extends BasePlugin {
  // 项目根路径
  servicePath = this.core.config.servicePath;
  // 代表构建产物的路径，非 ts 构建路径
  midwayBuildPath = (this.core.config.buildPath = join(
    this.servicePath,
    '.serverless'
  ));
  zipCodeDefaultName = 'serverless.zip';
  // 项目的 package.json 内容
  pkgJson: any = {};
  tsCodeRoot = 'src';

  private _skipTsBuild = false;
  commands = {
    package: {
      usage: 'Packages a Serverless service',
      lifecycleEvents: [
        'prepare', // 准备阶段
        'compile', // 编译阶段
        'functions', // 函数处理
        'platform', // 平台相关
        'dependencies', // 依赖处理
        'package', // 打包
        'finalize', // // 完成
      ],
      // 暂无
      options: {
        function: {
          usage: 'select function need to publish',
          shortcut: 'f',
        },
        npm: {
          usage: 'NPM client name',
        },
        buildDir: {
          usage: 'Build relative path, default is process.cwd()',
        },
        sourceDir: {
          usage: 'Source relative path, default is src',
        },
      },
    },
  };

  hooks = {
    'package:prepare': this.prepare.bind(this),
    'package:compile': this.compile.bind(this),
    'package:functions': this.functions.bind(this),
    'package:dependencies': this.dependencies.bind(this),
    'package:package': this.package.bind(this),
  };

  async prepare() {
    if (!this.core.config.specFile) {
      this.core.config.specFile = getSpecFile(this.servicePath);
    }
    process.chdir(this.servicePath);
    // 修改构建目标目录
    if (this.options.buildDir) {
      this.options.buildDir = transformPathToRelative(
        this.servicePath,
        this.options.buildDir
      );
      this.core.config.buildPath = join(
        this.servicePath,
        this.options.buildDir,
        '.serverless'
      );
      this.midwayBuildPath = this.core.config.buildPath;
    }

    if (await exists(this.midwayBuildPath)) {
      await remove(this.midwayBuildPath);
    }
    await ensureDir(this.midwayBuildPath);

    this.pkgJson = await readJson(join(this.servicePath, 'package.json'));
    // 安装研发期依赖
    await this.prepareInstallDevDep();
    // 定位项目结构
    await this.prepareLocate();
    // 拷贝非代码文件
    await this.prepareCopyFile();
  }

  // 编译 ts 代码
  async compile() {
    if (this._skipTsBuild) {
      return;
    }
    const { errors, necessaryErrors } = await compileTypeScript(
      this.midwayBuildPath,
      null,
      {
        target: 'es2018',
        module: 'commonjs',
        outDir: './dist',
        rootDir: 'src',
        experimentalDecorators: true,
      }
    );
    if (errors.length) {
      for (const error of errors) {
        this.core.cli.error(`\n[TS Error] ${error.message} (${error.path})`);
      }
      if (
        necessaryErrors.length &&
        !this.core.service?.experimentalFeatures?.ignoreTsError
      ) {
        throw new Error(
          `Error: ${necessaryErrors.length} ts error that must be fixed!`
        );
      }
    }
    await copyStaticFiles({
      sourceDir: this.tsCodeRoot,
      targetDir: join(this.midwayBuildPath, 'dist'),
    });
  }

  // 函数处理
  async functions() {
    process.chdir(this.midwayBuildPath);
    const { funcSpec, applicationContext } = await analysisDecorator(
      join(this.midwayBuildPath, 'dist'),
      this.core.service.functions
    );
    process.chdir(this.servicePath);
    this.core.service.functions = funcSpec;
    // 添加分析后引用 container
    this.setStore('MIDWAY_APPLICATION_CONTEXT', applicationContext, true);
    this.core.debug('funcSpec', funcSpec);
    // 高密度部署
    if (this.core.service.aggregation) {
      const { funcMap, logs } = aggregation(
        this.core.service.functions,
        this.core.service.aggregation
      );
      this.core.service.functions = funcMap;
      logs.forEach(log => this.core.cli.log(log));
    }

    // 单函数发布处理
    if (this.options.function) {
      const functions = this.options.function.split(',').filter(v => !!v);
      this.core.debug(' - Skip Function');
      Object.keys(this.core.service.functions).forEach(functionName => {
        if (!functions.includes(functionName)) {
          this.core.debug(`   skip ${functionName}`);
          delete this.core.service.functions[functionName];
        }
      });
    }

    // deployType 处理
    if (this.core.service?.deployType) {
      const service: any = this.core.service;
      const deployType =
        typeof service.deployType === 'string'
          ? service.deployType
          : service.deployType?.type;

      this.core.cli.log(` - found deployType: ${deployType}`);
      const version = service.deployType?.version
        ? `@${service.deployType.version}`
        : '';
      const deployName = service.deployType?.name ?? 'app_index';

      this.setGlobalDependencies('@midwayjs/simple-lock');

      if (!service.provider.initTimeout || service.provider.initTimeout < 10) {
        // just for aliyun
        service.provider.initTimeout = 10;
      }

      // add default function
      if (Object.keys(service.functions).length === 0) {
        this.core.cli.log(' - create default functions');
        service.functions = {
          [deployName]: {
            handler: 'index.handler',
            events: [{ http: { path: '/*' } }],
          },
        };
      }
      if (!service?.layers) {
        service.layers = {};
      }

      switch (deployType) {
        case 'egg':
        case 'express':
        case 'koa':
        case 'static':
          this.core.cli.log(` - create default layer: ${deployType}`);
          service.layers[deployType + 'Layer'] = {
            path: `npm:@midwayjs/${deployType}-layer${version}`,
          };
          break;
      }
    }

    writeToSpec(this.midwayBuildPath, this.core.service);
  }

  // 生产时期依赖处理
  async dependencies() {
    this.core.cli.log('Install production dependencies...');
    const { version } = findMidwayVersion(this.servicePath);
    this.setGlobalDependencies('@midwayjs/bootstrap', version.major || '*');
    this.setGlobalDependencies('path-to-regexp');
    // 支持全局依赖 setGlobalDependencies
    const allDependencies = Object.assign(
      {},
      this.core.service.globalDependencies,
      this.pkgJson.dependencies
    );
    // 支持依赖覆盖
    if (this.core.service.coverDependencies) {
      Object.keys(this.core.service.coverDependencies).forEach(depName => {
        if (!allDependencies[depName]) {
          return;
        }
        const coverDepValue = this.core.service.coverDependencies[depName];
        if (coverDepValue === false) {
          delete allDependencies[depName];
        } else {
          allDependencies[depName] = coverDepValue;
        }
      });
    }
    this.pkgJson.dependencies = {};
    for (const depName in allDependencies) {
      const depVersion = allDependencies[depName];
      this.pkgJson.dependencies[depName] = depVersion;
    }
    // 支持 resultions
    this.pkgJson.resolutions = Object.assign(
      {},
      this.pkgJson.resolutions,
      this.core.service.resolutions
    );

    // 避免因为在 devDeps 里面和 deps 都写了，导致有些npm 客户端忽略安装
    if (this.pkgJson.devDependencies) {
      Object.keys(this.pkgJson.devDependencies).forEach(devDep => {
        if (this.pkgJson.dependencies[devDep]) {
          delete this.pkgJson.devDependencies[devDep];
        }
      });
    }

    const pkgJsonPath: string = join(this.midwayBuildPath, 'package.json');
    writeFileSync(pkgJsonPath, JSON.stringify(this.pkgJson, null, 2));
    // 跳过依赖安装
    if (this.options.skipInstallDep) {
      this.core.cli.log(' - Production dependencies install skip');
      return;
    }

    let skipNpmInstall = false;
    // 极速依赖安装
    if (this.core.service?.experimentalFeatures?.fastInstallNodeModules) {
      this.core.debug('Fast Install Node Modules');
      const moduleInfoList = Object.keys(this.pkgJson.dependencies).map(
        name => {
          return {
            name,
            version: this.pkgJson.dependencies[name],
          };
        }
      );
      const start = Date.now();
      const copyResult = await copyFromNodeModules(
        moduleInfoList,
        join(this.servicePath, 'node_modules'),
        join(this.midwayBuildPath, 'node_modules')
      );
      skipNpmInstall = !!copyResult;
      this.core.debug('skipNpmInstall', skipNpmInstall, Date.now() - start);
    }

    if (!skipNpmInstall) {
      await installNpm({
        baseDir: this.midwayBuildPath,
        mode: ['production'],
        slience: true,
        debugLog: this.core.debug,
      });
    }
    // not await
    biggestDep(this.midwayBuildPath, this.core.cli.log);
    this.core.cli.log(' - Dependencies install complete');
  }

  async package() {
    this.core.cli.log('Package artifact...');
    // 跳过打包
    if (this.options.skipZip) {
      this.core.cli.log(' - Zip artifact skip');
      if (this.core.service?.experimentalFeatures?.removeUselessFiles) {
        this.core.cli.log(' - Experimental Feature RemoveUselessFiles');
        await removeUselessFiles(this.midwayBuildPath);
      }
      return;
    }
    // 构建打包
    const packageObj: any = this.core.service.package || {};

    let file = join(this.servicePath, this.zipCodeDefaultName);

    if (packageObj.artifact) {
      if (isAbsolute(packageObj.artifact)) {
        file = packageObj.artifact;
      } else {
        file = join(this.servicePath, packageObj.artifact);
      }
    }

    this.setStore('artifactFile', file, true);
    this.core.cli.log(` - Artifact file ${relative(this.servicePath, file)}`);

    // 保证文件存在，然后删了文件，只留目录
    await ensureFile(file);
    await remove(file);

    await makeZip(this.midwayBuildPath, file, {
      removeUselessFiles:
        this.core.service?.experimentalFeatures?.removeUselessFiles,
      npm: process.env.NPM_CLIENT || this.options.npm,
    });
    const stat = statSync(file);
    this.setStore('zipSize', stat.size, true);
    this.core.cli.log(
      ` - Zip size ${Number(stat.size / (1024 * 1024)).toFixed(2)}MB`
    );
    if (this.options.package) {
      const to = resolve(this.servicePath, this.options.package);
      await move(file, to);
    }
  }

  // 安装开发期依赖
  async prepareInstallDevDep() {
    let isNeedSkipInstallNodeModules = false;
    // 如果有 node_modules，且 package.json 中的模块在其中都有，则跳过依赖安装
    if (await exists(join(this.servicePath, 'node_modules'))) {
      const allDepMap = Object.assign(
        {},
        this.pkgJson.dependencies,
        this.pkgJson.devDependencies
      );
      const allDepList = Object.keys(allDepMap);
      let notInstalled = false;
      await Promise.all(
        allDepList.map(async depName => {
          const installed = await exists(
            join(this.servicePath, 'node_modules', depName)
          );
          if (!installed) {
            notInstalled = true;
          }
        })
      );
      if (!notInstalled) {
        isNeedSkipInstallNodeModules = true;
      }
    }

    if (!isNeedSkipInstallNodeModules) {
      this.core.cli.log('Install development dependencies...');
      await installNpm({
        baseDir: this.servicePath,
        slience: true,
      });
      this.core.cli.log(' - Install development dependencies complete...');
    } else {
      this.core.cli.log(' - Find node_modules and skip...');
    }
  }

  // 定位项目结构
  async prepareLocate() {
    // midway hooks 支持
    const config = resolveMidwayConfig(this.servicePath);
    if (config.exist) this.options.sourceDir = config.source;

    if (this.options.sourceDir) {
      this.options.sourceDir = transformPathToRelative(
        this.servicePath,
        this.options.sourceDir
      );
    }

    // 分析目录结构
    const locator = new Locator(this.servicePath);
    const codeAnalyzeResult: AnalyzeResult = await locator.run({
      tsCodeRoot:
        this.options.sourceDir &&
        join(this.servicePath, this.options.sourceDir),
    });
    this.setStore('codeAnalyzeResult', codeAnalyzeResult);
    this.core.debug('codeAnalyzeResult', codeAnalyzeResult);
    this.core.cli.log('Information');
    this.core.cli.log(` - BaseDir: ${this.servicePath}`);
    this.core.cli.log(' - AnalyzeResult');
    this.core.cli.log(`   - ProjectType: ${codeAnalyzeResult.projectType}`);
    if (codeAnalyzeResult.midwayRoot) {
      // 输出 midway-* 项目根路径
      this.core.cli.log(
        `   - MidwayRoot: ${
          this.servicePath === codeAnalyzeResult.midwayRoot
            ? '.'
            : relative(this.servicePath, codeAnalyzeResult.midwayRoot)
        }`
      );
      this.tsCodeRoot = relative(
        this.servicePath,
        codeAnalyzeResult.tsCodeRoot
      );
      // 输出 ts 代码根路径
      this.core.cli.log(`   - TSCodeRoot: ${this.tsCodeRoot}`);
      this.options.sourceDir = relative(
        this.servicePath,
        codeAnalyzeResult.tsCodeRoot
      );
      if (codeAnalyzeResult.integrationProject) {
        Object.assign(this.pkgJson, {
          name: codeAnalyzeResult.projectType,
          version: '1.0.0',
          dependencies: codeAnalyzeResult.usingDependenciesVersion.valid,
        });
      }
      // 输出构建产物根路径
      this.core.cli.log(
        `   - PackageRoot: ${relative(this.servicePath, this.midwayBuildPath)}`
      );
    }
  }

  async prepareCopyFile() {
    const specPackageConfig: any = this.core.service.package || {};
    if (!specPackageConfig.include) {
      specPackageConfig.include = [];
    }
    if (this.tsCodeRoot) {
      specPackageConfig.include.push(this.tsCodeRoot);
    }

    if (this.core.config.specFile.path) {
      // backup original yml file
      await copy(
        this.core.config.specFile.path,
        resolve(this.midwayBuildPath, './f.origin.yml')
      );
    }
    const exclude = [].concat(specPackageConfig.exclude || []);
    if (!specPackageConfig.lockFile) {
      exclude.push(...DefaultLockFiles);
    }

    // deployType 默认拷贝 dist 文件
    if (this.core.service?.deployType) {
      // 拷贝ts dist
      const tsConfig = resolve(this.servicePath, 'tsconfig.json');
      const tsDist = resolve(this.servicePath, 'dist');
      if (existsSync(tsConfig) && existsSync(tsDist)) {
        specPackageConfig.include.push('dist');
      }
    }
    exclude.push('**/src/**');
    await copyFiles({
      sourceDir: this.servicePath,
      targetDir: this.midwayBuildPath,
      include: [].concat(specPackageConfig.include),
      exclude,
    });

    const tsSourceDir = join(this.servicePath, this.tsCodeRoot);
    if (await exists(tsSourceDir)) {
      await copy(tsSourceDir, join(this.midwayBuildPath, 'src'));
    } else {
      this._skipTsBuild = true;
    }

    if (this.options.sharedDir) {
      this.options.sharedTargetDir = this.options.sharedTargetDir || 'static';
      this.options.sharedDir = transformPathToAbsolute(
        this.servicePath,
        this.options.sharedDir
      );
      this.options.sharedTargetDir = transformPathToAbsolute(
        this.midwayBuildPath,
        this.options.sharedTargetDir
      );
      await copy(this.options.sharedDir, this.options.sharedTargetDir);
    }
    this.core.cli.log(' - File copy complete');
  }

  finalize() {}
}
