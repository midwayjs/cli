import { BasePlugin } from '@midwayjs/command-core';
import { AnalyzeResult, Locator } from '@midwayjs/locate';
import {
  analysisResultToSpec,
  compareFileChange,
  copyFiles,
  copyStaticFiles,
} from '@midwayjs/faas-code-analysis';
import {
  CompilerHost,
  Program,
  resolveTsConfigFile,
  Analyzer,
} from '@midwayjs/mwcc';
import { writeWrapper } from '@midwayjs/serverless-spec-builder';
import * as FCTrigger from '@midwayjs/serverless-fc-trigger';
import * as SCFTrigger from '@midwayjs/serverless-scf-trigger';
import { resolve, relative, join } from 'path';
import {
  checkIsTsMode,
  cleanTarget,
  getLock,
  getPlatformPath,
  setLock,
  waitForLock,
  LOCK_TYPE,
} from './utils';
import {
  ensureFileSync,
  existsSync,
  writeFileSync,
  remove,
  readFileSync,
  copy,
  ensureDirSync,
  symlinkSync,
  mkdirSync,
} from 'fs-extra';
export * from './invoke';
export * from './interface';
export * from './utils';

export class FaaSInvokePlugin extends BasePlugin {
  baseDir: string;
  buildDir: string = resolve(this.core.config.servicePath, '.faas_debug_tmp');
  invokeFun: any;
  codeAnalyzeResult: AnalyzeResult;
  skipTsBuild: boolean;
  buildLockPath: string;
  buildLogDir: string;
  analysisCodeInfoPath: string;
  entryInfo: any;
  fileChanges: any;
  analyzedTsCodeRoot: string;

  private compilerHost: CompilerHost;
  private program: Program;

  get defaultTmpFaaSOut() {
    return resolve(
      this.core.config.servicePath,
      '.faas_debug_tmp/faas_tmp_out'
    );
  }
  commands = {
    invoke: {
      usage: '',
      lifecycleEvents: [
        'formatOptions', // 处理参数
        'locator', // 分析目录结构
        'copyFile', // 拷贝文件
        'checkFileChange', // 检查文件是否更新
        'compile', // ts 代码编译
        'analysisCode', // Todo: 代码分析，向前兼容
        'emit', // ts 代码输出
        'copyStaticFile', // 拷贝src中的静态文件到dist目录，例如 html 等
        'setFunctionList',
        'entry', // 生成执行入口
        'getInvoke', // 获取runtime
        'callInvoke', // 进行调用
        'clean', // 进行清理
      ],
      options: {
        function: {
          usage: 'function name',
          shortcut: 'f',
        },
        data: {
          usage: 'function args',
          shortcut: 'd',
        },
        debug: {
          usage: 'debug function',
        },
        trigger: {
          usage: 'trigger name',
          shortcut: 't',
        },
        port: {
          usage: 'start a invoke server use this port, default is 3000',
          shortcut: 'p',
        },
        tsConfig: {
          usage: 'tsConfig json file path',
        },
      },
    },
  };

  hooks = {
    'invoke:formatOptions': this.formatOptions.bind(this),
    'invoke:locator': this.locator.bind(this),
    'invoke:copyFile': this.copyFile.bind(this),
    'invoke:checkFileChange': this.checkFileChange.bind(this),
    'invoke:compile': this.compile.bind(this),
    'invoke:emit': this.emit.bind(this),
    'invoke:copyStaticFile': this.copyStaticFile.bind(this),
    'invoke:setFunctionList': this.setFunctionList.bind(this),
    'invoke:entry': this.entry.bind(this),
    'invoke:getInvoke': this.getInvoke.bind(this),
    'invoke:callInvoke': this.callInvoke.bind(this),
    'invoke:clean': this.clean.bind(this),
  };

  formatOptions() {
    // 开启增量编译，则不自动清理目录
    if (this.options.incremental) {
      this.options.clean = false;
    }
    if (this.options.clean !== false && this.options.clean !== 'false') {
      this.options.clean = true;
    }

    const envClean = process.env.MIDWAY_LOCAL_CLEAN;
    if (envClean === 'true') {
      this.options.clean = true;
      this.options.incremental = false;
    } else if (envClean === 'false') {
      this.options.clean = false;
    }

    if (this.options.clean) {
      cleanTarget(this.buildDir);
    }

    this.setStore('defaultTmpFaaSOut', this.defaultTmpFaaSOut);
  }

  async locator() {
    this.baseDir = this.core.config.servicePath;
    const lockKey = `codeAnalyzeResult:${this.baseDir}`;
    const { lockType, lockData } = getLock(lockKey);
    let codeAnalyzeResult;
    if (lockType === LOCK_TYPE.INITIAL) {
      setLock(lockKey, LOCK_TYPE.WAITING);
      // 分析目录结构
      const locator = new Locator(this.baseDir);
      codeAnalyzeResult = await locator.run({
        tsCodeRoot: this.options.sourceDir,
        tsBuildRoot: this.buildDir,
      });
      setLock(lockKey, LOCK_TYPE.COMPLETE, codeAnalyzeResult);
    } else if (lockType === LOCK_TYPE.COMPLETE) {
      codeAnalyzeResult = lockData;
    } else if (lockType === LOCK_TYPE.WAITING) {
      codeAnalyzeResult = await waitForLock(lockKey);
    }
    this.codeAnalyzeResult = codeAnalyzeResult;
  }

  async copyFile() {
    const packageObj = this.core.service.package || {};
    // clean directory first
    if (this.options.clean) {
      await cleanTarget(this.buildDir);
    }
    return copyFiles({
      sourceDir: this.baseDir,
      targetDir: this.buildDir,
      include: packageObj.include,
      exclude: packageObj.exclude,
      log: path => {
        this.core.debug('copy file', path);
      },
    });
  }

  public getTsCodeRoot() {
    const tmpOutDir = resolve(this.defaultTmpFaaSOut, 'src');
    if (existsSync(tmpOutDir)) {
      return tmpOutDir;
    } else {
      return this.codeAnalyzeResult.tsCodeRoot;
    }
  }

  async checkFileChange() {
    const tsconfig = resolve(this.baseDir, 'tsconfig.json');
    // 非ts
    if (!existsSync(tsconfig)) {
      this.skipTsBuild = true;
      return;
    }
    this.skipTsBuild = false;
    // 是否使用ts模式进行运行
    const isTsMode = this.checkIsTsMode();
    if (!isTsMode) {
      process.env.MIDWAY_TS_MODE = 'false';
    }
    // 构建锁文件
    this.buildLogDir = resolve(this.buildDir, 'log');
    ensureDirSync(this.buildLogDir);
    const buildLockPath = (this.buildLockPath = resolve(
      this.buildLogDir,
      '.faasTSBuildInfo.log'
    ));
    this.analysisCodeInfoPath = resolve(this.buildLogDir, '.faasFuncList.log');

    // 获取要分析的代码目录
    this.analyzedTsCodeRoot = this.getTsCodeRoot();
    // 扫描文件查看是否发生变化，乳沟没有变化就跳过编译
    const directoryToScan: string = relative(
      this.baseDir,
      this.analyzedTsCodeRoot
    );

    if (isTsMode) {
      return;
    }
    const { lockType } = getLock(this.buildLockPath);
    this.core.debug('lockType', lockType);
    // 如果当前存在构建任务，那么就进行等待
    if (lockType === LOCK_TYPE.INITIAL) {
      setLock(this.buildLockPath, LOCK_TYPE.WAITING);
    } else if (lockType === LOCK_TYPE.WAITING) {
      await waitForLock(this.buildLockPath);
    }

    const specFile = this.core.config.specFile.path;
    // 只有当非首次调用时才会进行增量分析，其他情况均进行全量分析
    if (existsSync(buildLockPath)) {
      this.core.debug('buildLockPath', buildLockPath);
      this.fileChanges = await compareFileChange(
        [specFile, `${directoryToScan}/**/*`],
        [buildLockPath],
        { cwd: this.baseDir }
      );
      if (!this.fileChanges || !this.fileChanges.length) {
        this.getAnaLysisCodeInfo();
        setLock(this.buildLockPath, LOCK_TYPE.COMPLETE);
        this.skipTsBuild = true;

        // for fp and oth plugin
        this.setStore('skipTsBuild', true, true);
        this.core.debug('Auto skip ts compile');
        return;
      }
    } else {
      this.fileChanges = [`${directoryToScan}/**/*`];
      // 如果没有构建锁，但是存在代码分析，这时候认为上一次是获取了函数列表
      // if (existsSync(this.analysisCodeInfoPath)) {
      //   this.getAnaLysisCodeInfo();
      // }
    }
    this.core.debug('fileChanges', this.fileChanges);
    setLock(this.buildLockPath, LOCK_TYPE.WAITING);
  }

  async compile() {
    // 如果在代码分析中止，那么可以从store中获取function信息
    this.setStore('functions', this.core.service.functions);

    // 如果跳过了ts编译，那么也就是说曾经编译过，那么也跳过代码分析
    if (this.skipTsBuild) {
      return;
    }

    const dest = join(this.buildDir, 'dist');
    const { config } = resolveTsConfigFile(
      this.baseDir,
      dest,
      this.options.tsConfig,
      this.getStore('mwccHintConfig', 'global'),
      {
        include: this.fileChanges,
        compilerOptions: {
          incremental: this.options.incremental,
          rootDir: this.analyzedTsCodeRoot,
        },
      }
    );
    this.compilerHost = new CompilerHost(this.baseDir, config);
    this.program = new Program(this.compilerHost);

    // 当spec上面没有functions的时候，启动代码分析
    if (!this.core.service.functions) {
      const analyzeInstance = new Analyzer({
        program: this.program,
        decoratorLowerCase: true,
      });
      const analyzeResult = analyzeInstance.analyze();
      const newSpec = await analysisResultToSpec(analyzeResult);
      this.core.debug('Code Analysis Result', newSpec);
      this.core.service.functions = newSpec.functions;
      this.setStore('functions', this.core.service.functions);
      ensureFileSync(this.analysisCodeInfoPath);
      writeFileSync(
        this.analysisCodeInfoPath,
        JSON.stringify(newSpec.functions, null, 2)
      );
    }
    if (this.core.pluginManager.options.stopLifecycle === 'invoke:compile') {
      // LOCK_TYPE.INITIAL 是因为跳过了ts编译，下一次来的时候还是得进行ts编译
      setLock(this.buildLockPath, LOCK_TYPE.INITIAL);
    }
    return this.core.service.functions;
  }

  getAnaLysisCodeInfo() {
    // 当spec上面没有functions的时候，利用代码分析的结果
    if (!this.core.service.functions) {
      try {
        this.core.service.functions = JSON.parse(
          readFileSync(this.analysisCodeInfoPath).toString()
        );
      } catch (e) {
        /** ignore */
      }
    }
  }

  async emit() {
    const isTsMode = this.checkIsTsMode();
    if (isTsMode || this.skipTsBuild) {
      return;
    }

    this.core.debug('emit', this.codeAnalyzeResult);
    try {
      await this.program.emit();

      const dest = join(this.buildDir, 'dist');
      if (!existsSync(dest)) {
        mkdirSync(dest);
      }
    } catch (e) {
      await remove(this.buildLockPath);
      setLock(this.buildLockPath, LOCK_TYPE.COMPLETE);
      this.core.debug('Typescript Build Error', e);
      if (e.message) {
        e.message = `Typescript Build Error, Please Check Your FaaS Code! ${e.message}`;
      }
      throw e;
    }
    setLock(this.buildLockPath, LOCK_TYPE.COMPLETE);
    // 针对多次调用清理缓存
    Object.keys(require.cache).forEach(path => {
      if (path.indexOf(this.buildDir) !== -1) {
        this.core.debug('Clear Cache', path);
        process.env.CLEAR_CACHE = 'true';
        delete require.cache[path];
      }
    });
    ensureFileSync(this.buildLockPath);
    writeFileSync(
      this.buildLockPath,
      JSON.stringify(this.fileChanges, null, 2)
    );
  }

  private async copyStaticFile() {
    const isTsMode = this.checkIsTsMode();
    if (isTsMode || this.skipTsBuild || !this.analyzedTsCodeRoot) {
      return;
    }
    return copyStaticFiles({
      sourceDir: this.analyzedTsCodeRoot,
      targetDir: resolve(this.buildDir, 'dist'),
      log: filePath => {
        this.core.debug('copyStaticFiles', filePath);
      },
    });
  }

  async setFunctionList() {
    // 这里是必须的，用以其他插件动态修改 functions，比如 hooks
    this.setStore('functions', this.core.service.functions);
    // 将函数信息放入代码分析结果缓存中，便于下次跳过ts编译时使用
    ensureFileSync(this.analysisCodeInfoPath);
    writeFileSync(
      this.analysisCodeInfoPath,
      JSON.stringify(this.core.service.functions, null, 2)
    );
  }

  checkUserEntry() {
    const funcInfo = this.getFunctionInfo();
    const [handlerFileName, name] = funcInfo.handler.split('.');
    const fileName = resolve(this.buildDir, `${handlerFileName}.js`);
    const userEntry = [
      resolve(this.baseDir, `${handlerFileName}.js`),
      resolve(this.baseDir, `${this.defaultTmpFaaSOut}/${handlerFileName}.js`),
    ].find(existsSync);
    return {
      funcInfo,
      name,
      userEntry,
      fileName,
    };
  }

  async entry() {
    const { name, fileName, userEntry } = this.checkUserEntry();
    if (!userEntry) {
      const isTsMode = this.checkIsTsMode();
      const starterName = this.getStarterName();
      if (!starterName) {
        return;
      }

      const {
        faasModName,
        initializeName,
        faasStarterName,
        advancePreventMultiInit,
      } = this.getEntryInfo();

      // 获取中间件
      const mw = this.core.service['feature'] || {};
      const middleware = Object.keys(mw).filter(item => !!mw[item]);

      writeWrapper({
        baseDir: this.baseDir,
        middleware,
        faasModName,
        initializeName,
        faasStarterName,
        advancePreventMultiInit,
        service: this.core.service,
        distDir: this.buildDir,
        preloadModules: this.getPreloadModules(),
        starter: getPlatformPath(starterName),
        loadDirectory: isTsMode
          ? [getPlatformPath(resolve(this.defaultTmpFaaSOut, 'src'))]
          : [],
      });
      if (isTsMode) {
        // ts模式 midway-core 会默认加载入口文件所在目录下的 src 目录里面的ts代码
        // 因此通过软连接的形式将其与原代码目录进行绑定
        const symlinkPath = resolve(this.buildDir, 'src');
        this.core.debug('tsMode symlink', symlinkPath);
        if (!existsSync(symlinkPath)) {
          symlinkSync(
            this.codeAnalyzeResult.tsCodeRoot,
            resolve(this.buildDir, 'src')
          );
        }
      }
    } else {
      copy(userEntry, fileName);
    }
    this.entryInfo = { fileName, handlerName: name };
    this.core.debug('EntryInfo', this.entryInfo);
  }

  public getEntryInfo() {
    return {
      faasModName: process.env.MidwayModuleName,
      initializeName: 'initializer',
      faasStarterName: 'FaaSStarter',
      advancePreventMultiInit: false,
    };
  }

  getPreloadModules() {
    return [];
  }

  getStarterName() {
    const platform = this.getPlatform();
    this.core.debug('Platform entry', platform);
    if (platform === 'aliyun') {
      return require.resolve('@midwayjs/serverless-fc-starter');
    } else if (platform === 'tencent') {
      return require.resolve('@midwayjs/serverless-scf-starter');
    }
  }

  async getInvoke() {
    let handler;
    // let initHandler;
    if (this.entryInfo) {
      try {
        const handlerMod = require(this.entryInfo.fileName);
        handler = handlerMod[this.entryInfo.handlerName];
        // initHandler = handlerMod.initializer;
      } catch (e) {
        e.message = `Get Invoke Handler Error: ${e.message}`;
        throw e;
      }
    }
    if (!handler) {
      throw new Error('Not Found Invoke Function');
    }

    this.invokeFun = async (...args) => {
      this.core.debug('- Invoke Origin Args', args);
      const trigger = await this.getTriggerInfo(args);
      let newArgs = trigger;
      let callBackTrigger;
      if (newArgs?.[0] && typeof newArgs[0].toArgs === 'function') {
        this.core.debug('- Invoke Args Functions');
        callBackTrigger = trigger[0];
        newArgs = await trigger[0].toArgs();
      }
      this.core.debug('- Invoke New Args', newArgs);
      const result = await new Promise((resolve, reject) => {
        if (callBackTrigger?.useCallback) {
          // 这个地方 callback 得调用 resolve
          const cb = callBackTrigger.createCallback((err, result) => {
            if (err) {
              return reject(err);
            }
            return resolve(result);
          });
          newArgs.push(cb);
        }
        Promise.resolve(handler.apply(this, newArgs)).then(resolve, reject);
      });
      if (callBackTrigger?.close) {
        await callBackTrigger.close();
      }
      return result;
    };
  }

  async getTriggerInfo(args) {
    const platform = this.getPlatform();
    let triggerMap;
    if (platform === 'aliyun') {
      triggerMap = FCTrigger;
    } else if (platform === 'tencent') {
      triggerMap = SCFTrigger;
    }
    return this.getTrigger(triggerMap, args);
  }

  async callInvoke() {
    const resultType = this.options.resultType;
    this.core.debug('ResultType', resultType);
    try {
      let args = this.options.data || '{}';
      if (typeof args === 'string') {
        if (/^\.\//.test(args)) {
          try {
            args = JSON.parse(readFileSync(args).toString());
            this.core.debug('Invoke Local Data', args);
          } catch (e) {
            this.core.debug('Invoke Local Data Parse Error', e);
          }
        } else {
          try {
            args = JSON.parse(args);
            this.core.debug('Invoke JSON Data', args);
          } catch (e) {
            this.core.debug('Invoke JSON Data Parse Error', e);
          }
        }
      }
      this.core.debug('Invoke Args', args);
      const result = await this.invokeFun(...[].concat(args));
      this.core.debug('Result', result);
      if (resultType !== 'store') {
        this.core.cli.log('--------- result start --------');
        this.core.cli.log('');
        this.core.cli.log(JSON.stringify(result));
        this.core.cli.log('');
        this.core.cli.log('--------- result end --------');
      } else {
        this.setStore('result', {
          success: true,
          result,
        });
      }
    } catch (e) {
      if (resultType === 'store') {
        this.setStore('result', {
          success: false,
          err: e,
        });
      }
      const errorLog = this.core.cli.error || this.core.cli.log;
      if (e?.message) {
        errorLog(`[Error Message] ${e.message}.\n${e.stack}`);
      } else {
        errorLog(e);
      }
    }
  }

  async clean() {
    if (this.options.clean) {
      await cleanTarget(this.buildDir);
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

  getFunctionInfo() {
    const functionName = this.options.function;
    const functionInfo =
      this.core.service.functions && this.core.service.functions[functionName];
    if (!functionInfo) {
      throw new Error(`Function: ${functionName} not exists`);
    }
    return functionInfo;
  }

  getTrigger(triggerMap, args) {
    if (!triggerMap) {
      return args;
    }
    let triggerName = this.options.trigger;
    if (!triggerName) {
      const funcInfo = this.getFunctionInfo();
      if (funcInfo.events && funcInfo.events.length) {
        triggerName = Object.keys(funcInfo.events[0])[0];
      }
    }
    const EventClass = triggerMap[triggerName || 'event'];
    if (EventClass) {
      return [new EventClass(...args)];
    }
    return args;
  }

  checkIsTsMode() {
    return checkIsTsMode();
  }
}
