import { join, resolve } from 'path';
import { writeFileSync, existsSync, readFileSync, copyFileSync } from 'fs';
import { render } from 'ejs';
import { getLayers } from './utils';
import * as micromatch from 'micromatch';
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
  advancePreventMultiInit?: boolean;
  faasStarterName?: string; // default is FaaSStarter
  middleware?: string[]; // middleware
}) {
  const {
    service,
    distDir,
    starter,
    baseDir,
    cover,
    faasModName,
    initializeName,
    advancePreventMultiInit,
    loadDirectory = [],
    faasStarterName,
    middleware,
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

    if (handlerConf._ignore) {
      continue;
    }
    const [handlerFileName, name] = handlerConf.handler.split('.');
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
    if (handlerConf.layers && handlerConf.layers.length) {
      files[handlerFileName].originLayers.push(handlerConf.layers);
    }
    // 高密度部署
    if (handlerConf._isAggregation) {
      files[handlerFileName].handlers.push({
        name,
        handlers: formetAggregationHandlers(handlerConf._handlers),
      });
    } else {
      files[handlerFileName].handlers.push({
        name,
        handler: handlerConf.handler,
      });
    }
  }

  const isCustomAppType = !!service?.deployType;

  const tpl = readFileSync(
    resolve(
      __dirname,
      isCustomAppType ? '../wrapper_app.ejs' : '../wrapper.ejs'
    )
  ).toString();

  if (functionMap?.functionList?.length) {
    const registerFunctionFile = join(distDir, 'registerFunction.js');
    const sourceFile = resolve(__dirname, '../registerFunction.js');
    if (!existsSync(registerFunctionFile) && existsSync(sourceFile)) {
      copyFileSync(sourceFile, registerFunctionFile);
    }
  }

  for (const file in files) {
    const fileName = join(distDir, `${file}.js`);
    const layers = getLayers(service.layers, ...files[file].originLayers);
    const content = render(tpl, {
      starter,
      faasModName: faasModName || '@midwayjs/faas',
      loadDirectory,
      // Todo: future need remove middleware, use egg
      middleware: middleware || [],
      faasStarterName: faasStarterName || 'FaaSStarter',
      advancePreventMultiInit: advancePreventMultiInit || false,
      initializer: initializeName || 'initializer',
      handlers: files[file].handlers,
      functionMap,
      ...layers,
    });
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

export function formetAggregationHandlers(handlers) {
  if (!handlers || !handlers.length) {
    return [];
  }
  return handlers
    .map(handler => {
      return {
        handler: handler.handler,
        router: handler.path.replace(/\*/g, '**'), // picomatch use **
        pureRouter: handler.path.replace(/\**$/, ''),
        level: handler.path.split('/').length - 1,
      };
    })
    .sort((handlerA, handlerB) => {
      if (handlerA.level === handlerB.level) {
        if (handlerB.pureRouter === handlerA.pureRouter) {
          return handlerA.router.length - handlerB.router.length;
        }
        return handlerB.pureRouter.length - handlerA.pureRouter.length;
      }
      return handlerB.level - handlerA.level;
    });
}

export const formatAggregation = (
  functions: any,
  aggregation: any,
  options?
) => {
  const { cli, getAggregationFunName } = options || {};
  const allAggregationPaths = [];
  const newFunction = { ...functions };
  let allFuncNames = Object.keys(newFunction);
  for (const aggregationName in aggregation) {
    const aggregationConfig = aggregation[aggregationName];
    const aggregationFuncName = getAggregationFunName
      ? getAggregationFunName(aggregationName)
      : aggregationName;
    newFunction[aggregationFuncName] = aggregationConfig;
    newFunction[aggregationFuncName].handler = `${aggregationFuncName}.handler`;
    newFunction[aggregationFuncName]._isAggregation = true;
    if (!newFunction[aggregationFuncName].events) {
      newFunction[aggregationFuncName].events = [];
    }
    // 忽略原始方法，不再单独进行部署
    const deployOrigin = aggregationConfig.deployOrigin;

    const allAggred = [];
    let handlers = [];

    if (aggregationConfig.functions || aggregationConfig.functionsPattern) {
      const matchedFuncName = [];
      const notMatchedFuncName = [];
      for (const functionName of allFuncNames) {
        let isMatch = false;
        if (aggregationConfig.functions) {
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

      handlers = matchedFuncName
        .map((functionName: string) => {
          const func = newFunction[functionName];
          if (!func || !func.events) {
            return;
          }
          const httpEventIndex = func.events.findIndex(
            (event: any) => !!event.http
          );
          if (httpEventIndex === -1) {
            return;
          }
          const httpEvent = func.events[httpEventIndex];
          if (!httpEvent || !httpEvent.http.path) {
            return;
          }
          allAggred.push({
            path: httpEvent.http.path,
            method: httpEvent.http.method,
          });
          if (!deployOrigin) {
            // 不把原有的函数进行部署
            cli?.log?.(
              ` - using function '${aggregationName}' to deploy '${functionName}'`
            );
            delete newFunction[functionName];
          }
          return {
            ...func,
            path: httpEvent.http.path,
          };
        })
        .filter((func: any) => !!func);
    }

    const allPaths = allAggred.map(aggre => aggre.path);
    let currentPath = commonPrefix(allPaths);
    currentPath =
      currentPath && currentPath !== '/' ? `${currentPath}/*` : '/*';
    cli?.log?.(
      ` - using path '${currentPath}' to deploy '${allPaths.join("', '")}'`
    );
    if (allAggregationPaths.indexOf(currentPath) !== -1) {
      cli?.error?.(
        `Cannot use the same prefix '${currentPath}' for aggregation deployment`
      );
    }
    allAggregationPaths.push(currentPath);
    newFunction[aggregationFuncName]._handlers = handlers;
    newFunction[aggregationFuncName]._allAggred = allAggred;
    newFunction[aggregationFuncName].events = [
      { http: { method: 'any', path: currentPath } },
    ];
  }
  return newFunction;
};

function commonPrefixUtil(str1: string, str2: string): string {
  let result = '';
  const n1 = str1.length;
  const n2 = str2.length;

  for (let i = 0, j = 0; i <= n1 - 1 && j <= n2 - 1; i++, j++) {
    if (str1[i] !== str2[j]) {
      break;
    }
    result += str1[i];
  }
  return result;
}

export function commonPrefix(arr: string[]): string {
  let prefix: string = (arr && arr[0]) || '';
  const n = (arr && arr.length) || 0;
  for (let i = 1; i <= n - 1; i++) {
    prefix = commonPrefixUtil(prefix, arr[i].replace(/([^/])$/, '$1/'));
  }
  if (!prefix || prefix === '/') {
    return '';
  }
  const result = prefix.replace(/\/[^/]*$/gi, '') || '/';
  if (result && !/^\//.test(result)) {
    return '/' + result;
  }
  return result;
}
