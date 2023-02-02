import {
  BasePlugin,
  findMidwayVersion,
  forkNode,
  copyFiles,
  copyStaticFiles,
  installNpm,
  findNpmModuleByResolve,
  exec,
  resolveMidwayConfig,
  compileTypeScript,
} from '@midwayjs/command-core';
import { getSpecFile, writeToSpec } from '@midwayjs/serverless-spec-builder';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import {
  copy,
  ensureDir,
  ensureFile,
  existsSync,
  move,
  readFileSync,
  remove,
  statSync,
  writeFileSync,
  writeJSON,
  readlink,
  lstat,
  readFile,
  createWriteStream,
  writeFile,
} from 'fs-extra';
import * as globby from 'globby';
import * as micromatch from 'micromatch';
import {
  commonPrefix,
  formatLayers,
  uselessFilesMatch,
  removeUselessFiles,
  analysisDecorator,
  copyFromNodeModules,
} from './utils';
import * as JSZip from 'jszip';
import { AnalyzeResult, Locator } from '@midwayjs/locate';
import { tmpdir, platform } from 'os';

export class PackagePlugin extends BasePlugin {
  options: any;
  midwayVersion = '';
  servicePath = this.core.config.servicePath;
  // 代表构建产物的路径，非 ts 构建路径
  midwayBuildPath = (this.core.config.buildPath = join(
    this.servicePath,
    '.serverless'
  ));
  defaultTmpFaaSOut = resolve(this.midwayBuildPath, 'faas_tem_out');
  codeAnalyzeResult: AnalyzeResult;
  integrationDistTempDirectory = 'integration_dist'; // 一体化构建的临时目录
  zipCodeDefaultName = 'serverless.zip';
  // 在 bundle 的情况下是否使用 hcc 编译 @midwayjs/hooks
  private isUseHcc = false;

  commands = {
    package: {
      usage: 'Packages a Serverless service',
      lifecycleEvents: [
        'cleanup', // 清理构建目录
        'installDevDep', // 安装开发期依赖
        'locate', // 确定项目结构
        'copyFile', // 拷贝文件: package.include 和 shared content
        'compile', //
        'analysisCode', // 分析代码
        'copyStaticFile', // 拷贝src中的静态文件到dist目录，例如 html 等
        'preload', // 预加载用户代码文件
        'checkAggregation', // 检测高密度部署
        'selectFunction', // 选择要发布的函数
        'generateSpec', // 生成对应平台的描述文件，例如 serverless.yml 等
        'generateEntry', // 生成对应平台的入口文件
        'installLayer', // 安装layer
        'installDep', // 安装依赖
        'bundle', // 打包成bundle，例如ncc
        'package', // 函数打包
        'finalize', // 完成
      ],
      // 暂无
      options: {
        npm: {
          usage: 'NPM client name',
        },
        buildDir: {
          usage: 'Build relative path, default is process.cwd()',
        },
        sourceDir: {
          usage: 'Source relative path, default is src',
        },
        sharedDir: {
          usage:
            'Shared directory relative path, default is undefined，package command will copy content to build directory root',
        },
        sharedTargetDir: {
          usage: 'Where the shared directory will be copied, default is static',
        },
        skipZip: {
          usage: 'Skip zip artifact',
          shortcut: 'z',
        },
        skipInstallDep: {
          usage: 'Skip Install Dependencies',
        },
        skipBuild: {
          usage: 'Skip funciton build',
        },
        resolve: {
          usage: 'Resolve layer versions and lock them in final archive',
          shortcut: 'r',
        },
        tsConfig: {
          usage: 'json string / file path / object',
        },
        function: {
          usage: 'select function need to publish',
          shortcut: 'f',
        },
      },
    },
  };

  hooks = {
    'package:cleanup': this.cleanup.bind(this),
    'package:installDevDep': this.installDevDep.bind(this),
    'package:locate': this.locate.bind(this),
    'before:package:copyFile': this.deployTypeBeforeCopyFile.bind(this),
    'package:copyFile': this.copyFile.bind(this),
    'package:compile': this.compile.bind(this),
    'package:preload': this.preload.bind(this),
    'package:installLayer': this.installLayer.bind(this),
    'package:installDep': this.installDep.bind(this),
    'package:checkAggregation': this.checkAggregation.bind(this),
    'package:selectFunction': this.selectFunction.bind(this),
    'package:package': this.package.bind(this),
    'before:package:generateSpec': this.defaultBeforeGenerateSpec.bind(this),
    'after:package:generateEntry': this.defaultGenerateEntry.bind(this),
    'before:package:finalize': this.finalize.bind(this),
    'package:copyStaticFile': this.copyStaticFile.bind(this),
    'package:analysisCode': this.analysisCode.bind(this),
    'package:bundle': this.bundle.bind(this),
  };

  async cleanup() {
    if (!this.core.config.specFile) {
      this.core.config.specFile = getSpecFile(this.servicePath);
    }
    process.chdir(this.servicePath);
    // 修改构建目标目录
    if (this.options.buildDir) {
      this.options.buildDir = this.transformToRelative(
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

    if (this.options.bundle) {
      // bundle 时默认跳过依赖安装
      this.options.skipInstallDep = this.options.skipInstallDep ?? true;
    }
    await remove(this.midwayBuildPath);
    await ensureDir(this.midwayBuildPath);
    this.setStore('defaultTmpFaaSOut', this.defaultTmpFaaSOut);
  }

  async installDevDep() {
    this.core.cli.log('Install development dependencies...');
    let isNeedSkipInstallNodeModules = false;
    if (existsSync(join(this.servicePath, 'node_modules'))) {
      let originPkgJson: any = {};
      try {
        const pkgJsonPath = join(this.servicePath, 'package.json');
        if (existsSync(pkgJsonPath)) {
          originPkgJson = JSON.parse(readFileSync(pkgJsonPath).toString());
        }
      } catch {
        //
      }
      const allDepMap = Object.assign(
        {},
        originPkgJson.dependencies,
        originPkgJson.devDependencies
      );
      const allDepList = Object.keys(allDepMap);
      const notInstalled = allDepList.find(depName => {
        return !existsSync(join(this.servicePath, 'node_modules', depName));
      });
      if (!notInstalled) {
        isNeedSkipInstallNodeModules = true;
      }
    }

    if (!isNeedSkipInstallNodeModules) {
      await this.npmInstall({
        baseDir: this.servicePath,
      });
      this.core.cli.log(' - Install development dependencies complete...');
    } else {
      this.core.cli.log(' - Find node_modules and skip...');
    }

    // 分析midway version
    const cwd = this.getCwd();
    const faasModulePath = findNpmModuleByResolve(cwd, '@midwayjs/faas');
    if (faasModulePath) {
      const pkgJson = JSON.parse(
        readFileSync(join(faasModulePath, 'package.json')).toString()
      );
      this.midwayVersion = pkgJson.version[0];
    }
    this.setStore('midwayVersion', this.midwayVersion, true);
    this.core.debug('midwayVersion', this.midwayVersion);
  }

  async locate() {
    const cwd = this.getCwd();

    // midway hooks 支持
    const config = resolveMidwayConfig(cwd);
    if (config.exist) this.options.sourceDir = config.source;

    if (this.options.sourceDir) {
      this.options.sourceDir = this.transformToRelative(
        this.servicePath,
        this.options.sourceDir
      );
    }

    // 分析目录结构
    const locator = new Locator(this.servicePath);
    this.codeAnalyzeResult = await locator.run({
      tsCodeRoot:
        this.options.sourceDir &&
        join(this.servicePath, this.options.sourceDir),
    });
    this.setStore('codeAnalyzeResult', this.codeAnalyzeResult);
    this.core.debug('codeAnalyzeResult', this.codeAnalyzeResult);
    this.core.cli.log('Information');
    this.core.cli.log(` - BaseDir: ${this.servicePath}`);
    this.core.cli.log(' - AnalyzeResult');
    this.core.cli.log(
      `   - ProjectType: ${this.codeAnalyzeResult.projectType}`
    );
    if (this.codeAnalyzeResult.midwayRoot) {
      // 输出 midway-* 项目根路径
      this.core.cli.log(
        `   - MidwayRoot: ${
          this.servicePath === this.codeAnalyzeResult.midwayRoot
            ? '.'
            : relative(this.servicePath, this.codeAnalyzeResult.midwayRoot)
        }`
      );
      // 输出 ts 代码根路径
      this.core.cli.log(
        `   - TSCodeRoot: ${relative(
          this.servicePath,
          this.codeAnalyzeResult.tsCodeRoot
        )}`
      );
      this.options.sourceDir = relative(
        this.servicePath,
        this.codeAnalyzeResult.tsCodeRoot
      );
      if (this.codeAnalyzeResult.integrationProject) {
        this.core.cli.log(
          `   - TSBuildTemporaryRoot: ${this.integrationDistTempDirectory}`
        );
        await remove(join(this.servicePath, this.integrationDistTempDirectory));
      } else {
        this.core.cli.log('   - TSBuildTemporaryRoot: dist');
      }
      // 输出构建产物根路径
      this.core.cli.log(
        `   - PackageRoot: ${relative(this.servicePath, this.midwayBuildPath)}`
      );
    }
  }

  async copyFile() {
    this.core.cli.log('Copy Files to build directory...');
    // copy packages config files
    const packageObj: any = this.core.service.package || {};
    if (this.core.config.specFile.path) {
      // backup original yml file
      await copy(
        this.core.config.specFile.path,
        resolve(this.midwayBuildPath, './f.origin.yml')
      );
      this.core.cli.log(
        `   - Copy ${this.core.config.specFile.path.replace(
          `${this.servicePath}/`,
          ''
        )} to ${'f.origin.yml'}`
      );
    }
    const exclude = [].concat(packageObj.exclude || []);
    if (!packageObj.lockFile) {
      exclude.push('yarn.lock');
      exclude.push('package-lock.json');
      exclude.push('pnpm-lock.yaml');
    }
    const tsCodeRoot: string = relative(this.servicePath, this.getTsCodeRoot());
    await copyFiles({
      sourceDir: this.servicePath,
      targetDir: this.midwayBuildPath,
      include: this.options.skipBuild
        ? [].concat(packageObj.include || [])
        : [tsCodeRoot].concat(packageObj.include || []),
      exclude,
      log: path => {
        this.core.cli.log(`   - Copy ${path}`);
      },
    });

    if (this.options.skipBuild) {
      // 跳过编译时也不处理package.json
      return;
    }
    if (this.codeAnalyzeResult.integrationProject) {
      let originPkgJson = {};
      try {
        const pkgJsonPath = join(this.servicePath, 'package.json');
        if (existsSync(pkgJsonPath)) {
          originPkgJson = JSON.parse(readFileSync(pkgJsonPath).toString());
        }
      } catch {
        //
      }
      await writeJSON(join(this.midwayBuildPath, 'package.json'), {
        name: this.codeAnalyzeResult.projectType,
        ...originPkgJson,
        version: '1.0.0',
        dependencies: this.codeAnalyzeResult.usingDependenciesVersion.valid,
      });
    }
    if (this.options.sharedDir) {
      this.options.sharedTargetDir = this.options.sharedTargetDir || 'static';
      this.core.cli.log(
        ` - Copy Shared Files to build directory(${this.options.sharedTargetDir})...`
      );
      this.options.sharedDir = this.transformToAbsolute(
        this.servicePath,
        this.options.sharedDir
      );
      this.options.sharedTargetDir = this.transformToAbsolute(
        this.midwayBuildPath,
        this.options.sharedTargetDir
      );
      await copy(this.options.sharedDir, this.options.sharedTargetDir);
    }
    this.core.cli.log(' - File copy complete');
  }

  async installLayer() {
    const npmList = this.getLayerNpmList();
    if (npmList && npmList.length) {
      this.core.cli.log('Install layers...');
      await this.npmInstall({
        npmList,
        production: true,
      });
      this.core.cli.log(' - Layers install complete');
    }
  }

  getLayerNpmList() {
    const funcLayers = [];
    if (this.core.service.functions) {
      for (const func in this.core.service.functions) {
        const funcConf = this.core.service.functions[func];
        if (funcConf.layers) {
          funcLayers.push(funcConf.layers);
        }
      }
    }
    const layerTypeList = formatLayers(this.core.service.layers, ...funcLayers);
    return Object.keys(layerTypeList.npm)
      .map((name: string) => {
        // ignore cover deps
        if (
          this.core.service.coverDependencies &&
          this.core.service.coverDependencies[name] === false
        ) {
          return false;
        }
        return layerTypeList.npm[name];
      })
      .filter(v => !!v);
  }

  async installDep() {
    this.core.cli.log('Install production dependencies...');
    const { version } = findMidwayVersion(this.servicePath);
    this.setGlobalDependencies('@midwayjs/bootstrap', version.major || '*');
    this.setGlobalDependencies('path-to-regexp', '6');
    // globalDependencies
    // pkg.json dependencies
    const pkgJsonPath: string = join(this.midwayBuildPath, 'package.json');
    let pkgJson: any = {};
    try {
      pkgJson = JSON.parse(readFileSync(pkgJsonPath).toString());
    } catch (e) {
      /** ignore */
    }
    const allDependencies = Object.assign(
      {},
      this.core.service.globalDependencies,
      pkgJson.dependencies
    );
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
    pkgJson.dependencies = {};
    for (const depName in allDependencies) {
      const depVersion = allDependencies[depName];
      pkgJson.dependencies[depName] = depVersion;
    }
    pkgJson.resolutions = Object.assign(
      {},
      pkgJson.resolutions,
      this.core.service.resolutions
    );

    // 避免因为在 devDeps 里面和 deps 都写了，导致有些npm 客户端忽略安装
    if (pkgJson.devDependencies) {
      Object.keys(pkgJson.devDependencies).forEach(devDep => {
        if (pkgJson.dependencies[devDep]) {
          delete pkgJson.devDependencies[devDep];
        }
      });
    }

    writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));

    if (this.options.skipInstallDep) {
      this.core.cli.log(' - Production dependencies install skip');
      return;
    }

    let skipNpmInstall = false;
    if (this.core.service?.experimentalFeatures?.fastInstallNodeModules) {
      this.core.debug('Fast Install Node Modules');
      const moduleInfoList = Object.keys(pkgJson.dependencies).map(name => {
        return {
          name,
          version: pkgJson.dependencies[name],
        };
      });
      const start = Date.now();
      const copyResult = await copyFromNodeModules(
        moduleInfoList,
        join(this.getCwd(), 'node_modules'),
        join(this.midwayBuildPath, 'node_modules')
      );
      skipNpmInstall = !!copyResult;
      this.core.debug('skipNpmInstall', skipNpmInstall, Date.now() - start);
    }

    if (!skipNpmInstall) {
      await this.npmInstall({
        production: true,
      });
    }
    // not await
    this.biggestDep();
    this.core.cli.log(' - Dependencies install complete');
  }

  public getTsCodeRoot(): string {
    return this.codeAnalyzeResult.tsCodeRoot || join(this.getCwd(), 'src');
  }

  // dep size anlysis
  private async biggestDep() {
    if (platform() === 'win32') {
      return;
    }
    let sizeRes;
    try {
      sizeRes = await exec({
        cmd: 'du -hs * | sort -h',
        baseDir: join(this.midwayBuildPath, 'node_modules'),
        slience: true,
      });
    } catch {
      // ignore catch
    }

    if (!sizeRes) {
      return;
    }

    const biggestModList = [];
    sizeRes
      .split('\n')
      .slice(-10)
      .forEach(mod => {
        if (!mod) {
          return;
        }
        const info = mod.split('\t');
        const size = info[0];
        let name = info[1];
        if (!size) {
          return;
        }
        name = name.replace(/^_|@\d.*$/g, '').replace('_', '/');
        if (name[0] === '@' && !name.includes('/')) {
          return;
        }
        biggestModList.push({
          size,
          name,
        });
      });
    if (!biggestModList.length) {
      return;
    }
    this.core.cli.log(' - Biggest Dependencies list:');
    biggestModList
      .slice(-5)
      .reverse()
      .forEach(modInfo => {
        this.core.cli.log(`    ${modInfo.size}\t${modInfo.name}`);
      });
  }

  async compile() {
    // 跳过编译
    if (this.options.skipBuild) {
      return;
    }
    // 不存在 tsconfig，跳过编译
    if (!existsSync(resolve(this.servicePath, 'tsconfig.json'))) {
      return;
    }
    const cwd = this.getCwd();
    const tsCodeRoot = this.getTsCodeRoot();
    const tsOptions = this.getTsConfig();
    await writeFile(
      join(this.midwayBuildPath, 'tsconfig.origin.json'),
      JSON.stringify(tsOptions, null, 2)
    );
    tsOptions.include = [tsCodeRoot];
    const commonJS = 'CommonJS';
    if (
      tsOptions.compilerOptions &&
      tsOptions.compilerOptions.module?.toLowerCase() !== commonJS.toLowerCase()
    ) {
      this.core.debug(
        `midway serverless 将使用 commonjs 进行ts编译（原始为 ${tsOptions.compilerOptions.module} ）`
      );
      tsOptions.compilerOptions.module = commonJS;
    }

    const { errors, necessaryErrors } = await compileTypeScript({
      baseDir: cwd,
      tsOptions,
      sourceDir: tsCodeRoot,
      outDir: join(this.midwayBuildPath, 'dist'),
    });
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
    // support ts alias
    let isNeedExecuteTscAlias = false;
    let tscAliasPath;
    if (tsOptions?.compilerOptions?.paths) {
      tscAliasPath = findNpmModuleByResolve(cwd, 'tsc-alias');
      if (!tscAliasPath) {
        this.core.cli.log(
          '您的 tsconfig.json 中使用了 paths alias 配置，而 tsc 在编译时无法处理此配置'
        );
        this.core.cli.log(
          '如果您希望它在 Midway 代码中被应用，请安装 tsc-alias 到您的 devDependencies 中'
        );
        this.core.cli.log(
          '然后重新发布，那么在构建时，您依赖的 tsc-alias 将会被加载，处理相关 alias 配置'
        );
      } else {
        Object.keys(tsOptions.compilerOptions.paths).forEach(alias => {
          isNeedExecuteTscAlias = true;
          const rules = tsOptions.compilerOptions.paths[alias];
          if (rules.length === 1) {
            const rule = rules[0];
            const relativePath = relative(rule.replace(/\*$/, ''), tsCodeRoot);
            if (relativePath && !relativePath.startsWith('..')) {
              const newAlias = alias.replace(/\/?\*?$/, `/${relativePath}/*`);
              tsOptions.compilerOptions.paths[newAlias] = rules;
              this.core.debug(
                `path alias: ${alias} 的规则 ${rule} 被自动添加到 ${newAlias} 中`
              );
            }
          } else {
            this.core.debug(`path alias: ${alias} 无法处理`);
          }
        });
      }
    }
    tsOptions.compilerOptions.outDir = 'dist';
    await writeFile(
      join(this.midwayBuildPath, 'tsconfig.json'),
      JSON.stringify(tsOptions, null, 2)
    );
    if (isNeedExecuteTscAlias) {
      const pkg = join(tscAliasPath, 'package.json');
      const bin = join(
        tscAliasPath,
        JSON.parse(readFileSync(pkg, 'utf-8')).bin['tsc-alias']
      );
      await exec({
        cmd: bin,
        baseDir: this.midwayBuildPath,
        log: this.core.cli.log,
      });
    }
  }

  private getCwd() {
    return this.servicePath || this.core.cwd || process.cwd();
  }

  private getTsConfig() {
    const cwd = this.getCwd();
    this.core.debug('CWD', cwd);
    let { tsConfig } = this.options;
    let tsConfigResult;
    if (typeof tsConfig === 'string') {
      // if ts config is file
      if (existsSync(tsConfig)) {
        tsConfig = readFileSync(tsConfig).toString();
      }
      try {
        tsConfigResult = JSON.parse(tsConfig);
      } catch (e) {
        console.log('[midway-bin] tsConfig should be JSON string or Object');
        throw e;
      }
    }
    const projectFile = resolve(cwd, 'tsconfig.json');
    if (!tsConfigResult) {
      if (!existsSync(projectFile)) {
        console.log(`[ Midway ] tsconfig.json not found in ${cwd}\n`);
        throw new Error('tsconfig.json not found');
      }
      try {
        tsConfigResult = JSON.parse(
          readFileSync(projectFile, 'utf-8').toString()
        );
      } catch (e) {
        console.log('[ Midway ] Read TsConfig Error', e.message);
        throw e;
      }
    }
    return tsConfigResult;
  }

  async preload() {
    if (this.midwayVersion !== '3' || !this.options.bundle) {
      return;
    }

    const midwayBuildPath = this.core.config.buildPath;
    const distDir = join(this.midwayBuildPath, 'dist');
    try {
      const modules = [];
      const { getPreloadCode } = require('@midwayjs/hcc');
      const hooksBundle = await getPreloadCode(midwayBuildPath, file => {
        if (/midway_preload|configuration/.test(file)) {
          return false;
        }
        modules.push(`require('./${file}')`);
        return true;
      });

      let code = `${hooksBundle};exports.modules = [${modules.join(', ')}];`;
      // TODO: fix hooks bug
      code = code.replace('will be overwritten.', 'will be overwritten.\n');
      code = code.replace("require('./configuration.js')", '');
      code = code.replace(/\)\s+require/, ');require');
      this.isUseHcc = true;
      writeFileSync(join(distDir, 'midway_hcc.js'), code);
    } catch {
      //
    }

    let preloadCode = '';
    // 预加载文件，加载各种函数文件
    const preloadFile = join(distDir, 'midway_preload_modules.js');
    const requireList = await globby(['**/*.js'], {
      cwd: distDir,
    });
    preloadCode += [
      // for midway hooks preload
      'let hccModules = {modules: []};',
      this.isUseHcc
        ? `try {
        hccModules = require('./midway_hcc.js');
        console.log("hccModules", hccModules);
      } catch(e) {
        console.log("hccModules error", e);
      }`
        : '',
      'exports.modules = [...(hccModules && hccModules.modules || []),',
      // for user code preload
      ...requireList.map(file => {
        return `  require('./${file}'),`;
      }),
      '];',
    ].join('\n');

    const configuratioCode = join(distDir, 'configuration.js');
    if (existsSync(configuratioCode)) {
      preloadCode += `
      let configurationModule = require('./configuration.js');
      if (configurationModule && configurationModule.default) {
        configurationModule = configurationModule.default;
      }
      if(typeof configurationModule === 'object') {
        const className = Object.keys(configurationModule).find(key => {
          const cls = configurationModule[key];
          if (typeof cls === 'function' && cls.prototype) {
            try {
              cls.arguments && cls.caller;
            } catch(e) {
              return true;
            }
          }
        });
        exports.Configuration = configurationModule[className];
      } else {
        exports.Configuration = configurationModule
      }
      `;
    }

    // TODO: fix ncc bug
    try {
      // eslint-disable-next-line
      const midwayFaasMod = require.resolve('@midwayjs/faas/package.json', {
        paths: [this.getCwd()],
      });
      const faasIndexPath = join(dirname(midwayFaasMod), './dist/index.js');
      let faasIndexCode = await readFile(faasIndexPath, 'utf8');
      faasIndexCode = faasIndexCode.replace(
        /"\.\/configuration"/g,
        '"@midwayjs/faas/dist/configuration"'
      );
      await writeFile(faasIndexPath, faasIndexCode);
    } catch {
      //
    }

    this.setStore(
      'preloadFile',
      relative(this.midwayBuildPath, preloadFile),
      true
    );
    writeFileSync(preloadFile, preloadCode);
  }

  async analysisCode() {
    // 跳过编译
    if (this.options.skipBuild) {
      return;
    }
    if (!this.core.service.functions) {
      this.core.service.functions = {};
    }
    process.chdir(this.midwayBuildPath);
    const { funcSpec, applicationContext } = await analysisDecorator(
      join(this.midwayBuildPath, 'dist'),
      this.core.service,
      this.core
    );
    process.chdir(this.core.cwd);
    this.core.service.functions = funcSpec;
    // 添加分析后引用 container
    this.setStore('MIDWAY_APPLICATION_CONTEXT', applicationContext, true);
    this.core.debug('funcSpec', funcSpec);
  }

  private outputTsErrorMessage(error, errorPath, prefixIndex = 0) {
    if (!error || !error.messageText) {
      return;
    }
    if (typeof error.messageText === 'object') {
      return this.outputTsErrorMessage(
        error.messageText,
        errorPath,
        prefixIndex
      );
    }

    if (!prefixIndex) {
      console.error(`\n[TS Error] ${error.messageText}${errorPath}`);
    } else {
      const prefix = ''.padEnd(prefixIndex * 2, ' ');
      console.error(`${prefix}${error.messageText}`);
    }
    if (Array.isArray(error.next) && error.next.length) {
      error.next.forEach(err => {
        this.outputTsErrorMessage(err, errorPath, prefixIndex + 1);
      });
    }
  }

  private copyStaticFile() {
    // 跳过编译
    if (this.options.skipBuild) {
      return;
    }
    const isTsDir = existsSync(join(this.servicePath, 'tsconfig.json'));
    if (!isTsDir) {
      return;
    }
    const tsCodeRoot: string = this.getTsCodeRoot();
    if (!tsCodeRoot) {
      return;
    }
    return copyStaticFiles({
      sourceDir: tsCodeRoot,
      targetDir: join(this.midwayBuildPath, 'dist'),
      log: filePath => {
        this.core.cli.log(' - copyStaticFiles', filePath);
      },
    });
  }

  // 生成默认入口
  async defaultGenerateEntry() {
    const functions = this.core.service.functions || {};
    for (const func in functions) {
      const handlerConf = functions[func];
      const [handlerFileName] = handlerConf.handler.split('.');
      const othEnterFile = [
        join(this.defaultTmpFaaSOut, handlerFileName + '.js'),
        join(this.core.config.servicePath, handlerFileName + '.js'),
      ].find(file => existsSync(file));
      if (othEnterFile) {
        const fileName = join(this.midwayBuildPath, `${handlerFileName}.js`);
        await copy(othEnterFile, fileName);
        this.core.debug('Use user entry', othEnterFile);
      }
    }
    if (existsSync(this.defaultTmpFaaSOut)) {
      this.core.debug('Tmp Out Dir Removed');
      await remove(this.defaultTmpFaaSOut);
    }
  }

  // 选择有哪些函数要进行发布
  async selectFunction() {
    if (!this.options.function) {
      return;
    }
    const functions = this.options.function.split(',').filter(v => !!v);
    if (!functions.length) {
      return;
    }
    this.core.debug(' - Skip Function');
    if (!this.core.service.functions) {
      return;
    }
    Object.keys(this.core.service.functions).forEach(functionName => {
      if (!functions.includes(functionName)) {
        this.core.debug(`   skip ${functionName}`);
        delete this.core.service.functions[functionName];
      }
    });
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

    await this.makeZip(this.midwayBuildPath, file);
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

  private async makeZip(sourceDirection: string, targetFileName: string) {
    let ignore = [];
    if (this.core.service?.experimentalFeatures?.removeUselessFiles) {
      this.core.cli.log(' - Experimental Feature RemoveUselessFiles');
      ignore = uselessFilesMatch;
    }
    const globbyMatched = ['**'];
    const npmClient = this.getNPMClient();
    if (npmClient?.startsWith('pnpm')) {
      globbyMatched.push('**/.pnpm/**');
    }

    // include file
    const { include, exclude } = this.core.service.package || {};
    if (Array.isArray(include)) {
      for (const pattern of include) {
        if (typeof pattern === 'string') {
          globbyMatched.push(pattern);
        }
      }
    }
    // eclude file
    if (Array.isArray(exclude)) {
      for (const pattern of exclude) {
        if (typeof pattern === 'string') {
          ignore.push(pattern);
        }
      }
    }

    const fileList = await globby(globbyMatched, {
      onlyFiles: false,
      followSymbolicLinks: false,
      cwd: sourceDirection,
      ignore,
    });
    const zip = new JSZip();
    const isWindows = platform() === 'win32';
    for (const fileName of fileList) {
      const absPath = join(sourceDirection, fileName);
      const stats = await lstat(absPath);
      if (stats.isDirectory()) {
        zip.folder(fileName);
      } else if (stats.isSymbolicLink()) {
        let link = await readlink(absPath);
        if (isWindows) {
          link = relative(dirname(absPath), link).replace(/\\/g, '/');
        }
        zip.file(fileName, link, {
          binary: false,
          createFolders: true,
          unixPermissions: stats.mode,
        });
      } else if (stats.isFile()) {
        const fileData = await readFile(absPath);
        zip.file(fileName, fileData, {
          binary: true,
          createFolders: true,
          unixPermissions: stats.mode,
        });
      }
    }
    await new Promise((res, rej) => {
      zip
        .generateNodeStream({
          platform: 'UNIX',
          compression: 'DEFLATE',
          compressionOptions: {
            level: 6,
          },
        })
        .pipe(createWriteStream(targetFileName))
        .once('finish', res)
        .once('error', rej);
    });
  }

  private getNPMClient() {
    return process.env.NPM_CLIENT || this.options.npm;
  }

  // 安装npm到构建文件夹
  private async npmInstall(
    options: {
      npmList?: string[];
      baseDir?: string;
      production?: boolean;
    } = {}
  ) {
    return new Promise((resolve, reject) => {
      const installDirectory = options.baseDir || this.midwayBuildPath;
      const pkgJson: string = join(installDirectory, 'package.json');
      if (!existsSync(pkgJson)) {
        writeFileSync(pkgJson, '{}');
      }
      installNpm({
        baseDir: installDirectory,
        moduleName: options.npmList ? `${options.npmList.join(' ')}` : '',
        mode: options.production ? ['production'] : [],
        register: this.getNPMClient(),
        registerPath: this.options.registry,
        slience: true,
        debugLog: this.core.debug,
      })
        .then(resolve)
        .catch(err => {
          const errmsg = (err && err.message) || err;
          this.core.cli.log(` - npm install err ${errmsg}`);
          reject(errmsg);
        });
    });
  }

  private transformToRelative(baseDir, targetDir) {
    if (targetDir) {
      if (isAbsolute(targetDir)) {
        return relative(baseDir, targetDir);
      }
      return targetDir;
    }
  }

  private transformToAbsolute(baseDir, targetDir) {
    if (targetDir) {
      if (!isAbsolute(targetDir)) {
        return join(baseDir, targetDir);
      }
      return targetDir;
    }
  }

  // 合并高密度部署
  async checkAggregation() {
    // 只在部署阶段生效
    const commands = this.core.processedInput.commands;
    if (
      !commands ||
      !commands.length ||
      (commands[0] !== 'deploy' && commands[0] !== 'package')
    ) {
      return;
    }
    if (!this.core.service.aggregation || !this.core.service.functions) {
      return;
    }

    if (this.core.service?.deployType) {
      return;
    }

    this.core.cli.log('Aggregation Deploy');

    // use picomatch to match url
    const allAggregationPaths = [];
    let allFuncNames = Object.keys(this.core.service.functions);
    for (const aggregationName in this.core.service.aggregation) {
      const aggregationConfig = this.core.service.aggregation[aggregationName];
      const aggregationFuncName = this.getAggregationFunName(aggregationName);
      this.core.service.functions[aggregationFuncName] = aggregationConfig;
      this.core.service.functions[
        aggregationFuncName
      ].handler = `${aggregationFuncName}.handler`;
      this.core.service.functions[aggregationFuncName]._isAggregation = true;
      if (!this.core.service.functions[aggregationFuncName].events) {
        this.core.service.functions[aggregationFuncName].events = [];
      }
      // 忽略原始方法，不再单独进行部署
      const deployOrigin = aggregationConfig.deployOrigin;

      let handlers = [];
      const allAggredHttpTriggers = [];
      const allAggredEventTriggers = [];
      if (aggregationConfig.functions || aggregationConfig.functionsPattern) {
        const matchedFuncName = [];
        const notMatchedFuncName = [];
        const functions = this.core.service.functions;
        for (const functionName of allFuncNames) {
          const func = functions[functionName];
          const isHttpFunction = func.events?.find(event => {
            return Object.keys(event)[0] === 'http';
          });
          // http 函数并且开启了 eventTrigger，需要忽略
          // 非 http 函数，并且没有开启  eventTrigger，需要忽略
          let isMatch = false;
          if (
            (isHttpFunction && aggregationConfig.eventTrigger) ||
            (!isHttpFunction && !aggregationConfig.eventTrigger)
          ) {
            isMatch = false;
          } else if (aggregationConfig.functions) {
            isMatch = aggregationConfig.functions.indexOf(functionName) !== -1;
          } else if (aggregationConfig.functionsPattern) {
            isMatch = micromatch.all(
              functionName,
              aggregationConfig.functionsPattern
            );
          }
          if (isMatch) {
            matchedFuncName.push(functionName);
          } else {
            notMatchedFuncName.push(functionName);
          }
        }
        allFuncNames = notMatchedFuncName;
        matchedFuncName.forEach((functionName: string) => {
          const functions = this.core.service.functions;
          const func = functions[functionName];
          if (!func || !func.events) {
            return;
          }

          for (const event of func.events) {
            const eventType = Object.keys(event)[0];
            const handlerInfo: any = {
              ...func,
              functionName,
              eventType,
            };
            if (eventType === 'http') {
              const httpInfo = {
                path: event.http.path,
                method: event.http.method,
              };
              allAggredHttpTriggers.push(httpInfo);
              Object.assign(handlerInfo, httpInfo);
            } else if (aggregationConfig.eventTrigger) {
              // 事件触发器支持
              const existsEventTrigger = handlers.find(
                handlerInfo => handlerInfo.eventType === eventType
              );
              if (!existsEventTrigger) {
                allAggredEventTriggers.push(event);
              }
            } else {
              continue;
            }
            if (!deployOrigin) {
              // 不把原有的函数进行部署
              this.core.cli.log(
                ` - using function '${aggregationName}' to deploy '${functionName}'`
              );
              delete this.core.service.functions[functionName];
            }

            handlers.push(handlerInfo);
          }
        });
      }
      handlers = handlers.filter((func: any) => !!func);

      this.core.service.functions[aggregationFuncName]._handlers = handlers;
      this.core.service.functions[aggregationFuncName]._allAggred =
        allAggredHttpTriggers;
      this.core.service.functions[aggregationFuncName].events =
        allAggredEventTriggers;

      if (allAggredHttpTriggers?.length) {
        const allPaths = allAggredHttpTriggers.map(aggre => aggre.path);
        let currentPath = commonPrefix(allPaths);
        currentPath =
          currentPath && currentPath !== '/' ? `${currentPath}/*` : '/*';

        this.core.cli.log(
          ` - using path '${currentPath}' to deploy '${allPaths.join("', '")}'`
        );
        // path parameter
        if (currentPath.includes(':')) {
          const newCurrentPath = currentPath.replace(/\/:.*$/, '/*');
          this.core.cli.log(
            ` - using path '${newCurrentPath}' to deploy '${currentPath}' (for path parameter)`
          );
          currentPath = newCurrentPath;
        }
        if (allAggregationPaths.indexOf(currentPath) !== -1) {
          console.error(
            `Cannot use the same prefix '${currentPath}' for aggregation deployment`
          );
          process.exit(1);
        }
        allAggregationPaths.push(currentPath);
        this.core.service.functions[aggregationFuncName].events.push({
          http: { method: 'any', path: currentPath },
        });
      }
    }

    const tmpSpecFile = resolve(tmpdir(), `aggre-${Date.now()}/f.yml`);
    await ensureFile(tmpSpecFile);

    this.core.config.specFile.path = tmpSpecFile;
    writeToSpec(this.servicePath, this.core.service, this.core.config.specFile);
  }

  getAggregationFunName(aggregationName: string) {
    return aggregationName;
  }

  deployTypeBeforeCopyFile() {
    const service: any = this.core.service;
    if (service?.deployType) {
      // 拷贝ts dist
      const tsConfig = resolve(this.servicePath, 'tsconfig.json');
      const tsDist = resolve(this.servicePath, 'dist');
      if (existsSync(tsConfig) && existsSync(tsDist)) {
        if (!service.package) {
          service.package = {};
        }
        if (!service.package.include) {
          service.package.include = [];
        }
        service.package.include.push('dist');
      }
    }
  }

  defaultBeforeGenerateSpec() {
    const service: any = this.core.service;
    if (service?.deployType) {
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

      this.core.cli.log(' - create default functions');
      service.functions = {
        [deployName]: {
          handler: 'index.handler',
          events: [{ http: { path: '/*' } }],
        },
      };
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

  async bundle() {
    if (!this.options.bundle) {
      return;
    }
    const nccPkgJsonFile = require.resolve('@vercel/ncc/package');
    const nccPkgJson = JSON.parse(readFileSync(nccPkgJsonFile).toString());
    const nccCli = join(nccPkgJsonFile, '../', nccPkgJson.bin.ncc);

    const entryList = await globby(['*.js'], {
      cwd: this.midwayBuildPath,
    });

    if (!entryList.length) {
      return;
    }

    this.core.cli.log('Build bundle...');

    await Promise.all(
      entryList.map(async entry => {
        if (entry === 'midway.config.js' || entry === 'jest.config.js') {
          return;
        }
        const entryPath = join(this.midwayBuildPath, entry);
        if (this.isUseHcc) {
          // 如果使用了 hcc 编译 midway hooks，在入口需要添加 hooks的编译文件，解决 midway.config.js 文件加载问题
          const entryCode = await readFile(entryPath, 'utf8');
          await writeFile(
            entryPath,
            'require("./dist/midway_hcc.js");' + entryCode
          );
        }
        const entryName = entry.slice(0, -3);
        await forkNode(
          nccCli,
          ['build', entry, '-o', 'ncc_build_tmp/' + entryName],
          {
            cwd: this.midwayBuildPath,
          }
        );
        await remove(entryPath);
        await move(
          join(
            this.midwayBuildPath,
            'ncc_build_tmp/' + entryName + '/index.js'
          ),
          entryPath
        );
      })
    );

    await remove(join(this.midwayBuildPath, 'node_modules'));
    await remove(join(this.midwayBuildPath, 'dist'));
    await remove(join(this.midwayBuildPath, 'ncc_build_tmp'));
    await remove(join(this.midwayBuildPath, 'src'));
  }

  finalize() {}
}
