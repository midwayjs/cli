import { join, resolve } from 'path';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { render } from 'ejs';
import { getFaaSPackageVersion, getLayers } from './utils';
// 写入口
export function writeWrapper(options: {
  service: any;
  baseDir: string;
  distDir: string;
  starter: string;
  cover?: boolean;
  loadDirectory?: string[];
  initializeName?: string; // default is initializer
  faasModName?: string; // default is '@midwayjs/faas'
  advancePreventMultiInit?: boolean; // v1:
  faasStarterName?: string; // default is FaaSStarter
  middleware?: string[]; // v1: middleware
  clearCache?: boolean; // v1: clearContainerCache clearModule
  moreArgs?: boolean; // v1, aggregation more args
  specificStarterName?: string; // v3: f.yml specific starter name
  preloadModules?: string[]; // pre load module
  templatePath?: string; // ejs template path
  preloadFile?: string; // pre require in entry file
  moreTemplateVariables?: any;
  isDefaultFunc?: boolean; // for worker
  aggregationBeforeExecScript?: string; // 高密度部署前置模板脚本
  initializeInHandler?: boolean; // 在 handler 中初始化
}) {
  const {
    service,
    distDir,
    starter,
    baseDir,
    cover,
    faasModName = '@midwayjs/faas',
    initializeName,
    advancePreventMultiInit,
    loadDirectory = [],
    preloadModules = [],
    faasStarterName,
    middleware,
    clearCache = true,
    templatePath,
    moreArgs,
    preloadFile,
    moreTemplateVariables = {},
    aggregationBeforeExecScript = '',
    specificStarterName = '',
    initializeInHandler = false,
    isDefaultFunc = false,
  } = options;

  const files = {};

  // for function programing，function
  let functionMap: any;
  const functions = service.functions || {};
  for (const func in functions) {
    const handlerConf = functions[func];
    // for fp
    functionMap = assignToFunctionMap(functionMap, handlerConf);
    // for aggregation fp
    if (handlerConf._handlers) {
      handlerConf._handlers.forEach(innerHandlerConf => {
        functionMap = assignToFunctionMap(functionMap, innerHandlerConf);
      });
    }
    const handlerSplitInfo = handlerConf.handler.split('.');
    let handlerFileName = handlerConf.handlerFileName || handlerSplitInfo[0];
    const name = handlerSplitInfo[1];
    if (isDefaultFunc) {
      handlerFileName = func;
    }
    if (!cover && existsSync(join(baseDir, handlerFileName + '.js'))) {
      // 如果入口文件名存在，则跳过
      continue;
    }
    if (!files[handlerFileName]) {
      files[handlerFileName] = {
        handlers: [],
        originLayers: [],
      };
    }

    if (isDefaultFunc) {
      files[handlerFileName].defaultFunctionHandlerName = name;
    }

    if (handlerConf.layers && handlerConf.layers.length) {
      files[handlerFileName].originLayers.push(handlerConf.layers);
    }
    // 高密度部署
    if (handlerConf._isAggregation) {
      files[handlerFileName].aggregationHandlerName = handlerConf.handler;
      files[handlerFileName].handlers.push({
        name,
        handlers: formatAggregationHandlers(handlerConf._handlers),
      });
    } else {
      files[handlerFileName].handlers.push({
        name,
        handler: handlerConf.handler,
      });
    }
  }

  let tplPath = templatePath;
  if (!tplPath) {
    let entryWrapper = '../wrapper_v1.ejs';
    const isCustomAppType = !!service?.deployType;
    // 指定了 deployType
    if (isCustomAppType) {
      entryWrapper = '../wrapper_app.ejs';
    } else if (specificStarterName) {
      entryWrapper = '../wrapper_v3_specific.ejs';
    } else {
      const faasVersion = getFaaSPackageVersion(distDir, baseDir);
      if (faasVersion === 2) {
        entryWrapper = '../wrapper_v2.ejs';
      } else if (faasVersion === 3) {
        entryWrapper = '../wrapper_v3.ejs';
      }
    }
    tplPath = resolve(__dirname, entryWrapper);
  }

  const tpl = readFileSync(tplPath).toString();

  if (functionMap?.functionList?.length) {
    const target = join(distDir, 'registerFunction.js');
    const source = readFileSync(
      join(__dirname, '../hooks_runtime.ejs'),
      'utf-8'
    );

    const runtime = render(source, {
      runtime: service?.hooks?.runtime ?? 'compiler',
    });

    if (!existsSync(target)) {
      writeFileSync(target, runtime, { encoding: 'utf-8' });
    }
  }

  for (const file in files) {
    const fileName = join(distDir, `${file}.js`);
    const fileInfo = files[file];
    const layers = getLayers(service.layers, ...fileInfo.originLayers);
    let variables = {
      starter,
      runtimeConfig: service, // yaml data
      faasModName: faasModName || '@midwayjs/faas',
      loadDirectory,
      // Todo: future need remove middleware, use egg
      middleware: middleware || [],
      faasStarterName: faasStarterName || 'FaaSStarter',
      advancePreventMultiInit: advancePreventMultiInit || false,
      initializer: initializeName || 'initializer',
      handlers: fileInfo.handlers,
      functionMap,
      preloadModules,
      clearCache,
      moreArgs: moreArgs || false,
      preloadFile,
      aggregationBeforeExecScript,
      specificStarterName,
      initializeInHandler,
      defaultFunctionHandlerName: files[file].defaultFunctionHandlerName, // for worker
      aggregationHandlerName: files[file].aggregationHandlerName, // for v3 specific
      ...layers,
    };
    // 更多变量
    if (typeof moreTemplateVariables === 'object') {
      Object.assign(variables, moreTemplateVariables);
    } else if (typeof moreTemplateVariables === 'function') {
      variables = moreTemplateVariables({
        file,
        fileInfo,
        variables,
      });
    }
    const content = render(tpl, variables);
    if (existsSync(fileName)) {
      const oldContent = readFileSync(fileName).toString();
      if (oldContent === content) {
        continue;
      }
    }
    writeFileSync(fileName, content);
  }
}

const assignToFunctionMap = (functionMap, handlerConf) => {
  if (handlerConf.isFunctional) {
    if (!functionMap?.functionList) {
      functionMap = { functionList: [] };
    }
    functionMap.functionList.push({
      functionName: handlerConf.exportFunction,
      functionHandler: handlerConf.handler,
      functionFilePath: handlerConf.sourceFilePath,
      argsPath: handlerConf.argsPath,
    });
  }
  return functionMap;
};

export function formatAggregationHandlers(handlers) {
  if (!handlers || !handlers.length) {
    return [];
  }
  return handlers
    .map(handler => {
      const { path = '', eventType } = handler;
      if (eventType !== 'http') {
        return {
          ...handler,
          level: -1,
        };
      }
      return {
        ...handler,
        method: (handler.method ? [].concat(handler.method) : []).map(
          method => {
            return method.toLowerCase();
          }
        ),
        handler: handler.handler,
        router: path.replace(/\*/g, '**'), // picomatch use **
        pureRouter: path.replace(/\**$/, ''),
        regRouter: path.replace(/\/\*$/, '/(.*)?') || '/(.*)?', // path2regexp match use (.*)?
        level: path.split('/').length - 1,
        paramsMatchLevel: path.indexOf('/:') !== -1 ? 1 : 0,
      };
    })
    .sort((handlerA, handlerB) => {
      if (handlerA.level === handlerB.level) {
        if (handlerA.level < 0) {
          return -1;
        }
        if (handlerB.pureRouter === handlerA.pureRouter) {
          return handlerA.router.length - handlerB.router.length;
        }
        if (handlerA.paramsMatchLevel === handlerB.paramsMatchLevel) {
          return handlerB.pureRouter.length - handlerA.pureRouter.length;
        }
        return handlerA.paramsMatchLevel - handlerB.paramsMatchLevel;
      }
      return handlerB.level - handlerA.level;
    });
}
