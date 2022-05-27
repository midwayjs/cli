import { IAggregationConfig } from './interface';
import * as micromatch from 'micromatch';
export const aggregation = (
  funcMap,
  allAggregationConf: IAggregationConfig
) => {
  const logs = [];
  const allAggregationPaths = [];
  let allFuncNames = Object.keys(funcMap);
  for (const aggregationName in allAggregationConf) {
    const aggregationConfig = allAggregationConf[aggregationName];
    const aggregationFuncName = aggregationName;
    funcMap[aggregationFuncName] = aggregationConfig;
    funcMap[aggregationFuncName].handler = `${aggregationFuncName}.handler`;
    funcMap[aggregationFuncName]._isAggregation = true;
    if (!funcMap[aggregationFuncName].events) {
      funcMap[aggregationFuncName].events = [];
    }
    // 忽略原始方法，不再单独进行部署
    const deployOrigin = aggregationConfig.deployOrigin;

    let handlers = [];
    const allAggredHttpTriggers = [];
    const allAggredEventTriggers = [];

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
      matchedFuncName.forEach((functionName: string) => {
        const functions = funcMap;
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
            logs.push(
              ` - using function '${aggregationName}' to deploy '${functionName}'`
            );
            delete funcMap[functionName];
          }

          handlers.push(handlerInfo);
        }
      });
    }
    handlers = handlers.filter((func: any) => !!func);

    funcMap[aggregationFuncName]._handlers = handlers;
    funcMap[aggregationFuncName]._allAggred = allAggredHttpTriggers;
    funcMap[aggregationFuncName].events = allAggredEventTriggers;

    if (allAggredHttpTriggers?.length) {
      const allPaths = allAggredHttpTriggers.map(aggre => aggre.path);
      let currentPath = commonPrefix(allPaths);
      currentPath =
        currentPath && currentPath !== '/' ? `${currentPath}/*` : '/*';

      logs.push(
        ` - using path '${currentPath}' to deploy '${allPaths.join("', '")}'`
      );
      // path parameter
      if (currentPath.includes(':')) {
        const newCurrentPath = currentPath.replace(/\/:.*$/, '/*');
        logs.push(
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
      funcMap[aggregationFuncName].events.push({
        http: { method: 'any', path: currentPath },
      });
    }
  }
  return { funcMap, logs };
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
    prefix = commonPrefixUtil(prefix, arr[i]);
  }
  if (!prefix || prefix === '/') {
    return '';
  }
  const result = prefix.replace(/\/[^/]*$/gi, '') || '/';
  if (result && !/^\//.test(result)) {
    return '/' + result;
  }
  if (result === '/') {
    return '';
  }
  return result;
}
