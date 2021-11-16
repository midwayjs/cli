import { DevPackOptions, InvokeOptions } from './interface';
import { match } from 'path-to-regexp';
import * as qs from 'querystring';
import { getPath, getQuery } from './utils';
const getRawBody = require('raw-body');
const ignoreWildcardFunctionsWhiteList = [];

export async function parseInvokeOptionsByOriginUrl(
  options: DevPackOptions,
  req,
  getFuncList
): Promise<{
  invokeOptions: Partial<InvokeOptions>;
  invokeFun?: any;
}> {
  const ignorePattern = options.ignorePattern;
  const currentUrl = getPath(req);
  const currentMethod = req.method.toLowerCase();
  if (ignorePattern) {
    if (typeof ignorePattern === 'function') {
      if (ignorePattern(req)) {
        return {
          invokeOptions: {},
        };
      }
    } else if (ignorePattern.length) {
      for (const pattern of ignorePattern as string[]) {
        if (new RegExp(pattern).test(currentUrl)) {
          return {
            invokeOptions: {},
          };
        }
      }
    }
  }
  const invokeOptions: Partial<InvokeOptions> = {};
  invokeOptions.functionDir = options.functionDir;
  invokeOptions.sourceDir = options.sourceDir;
  invokeOptions.verbose = options.verbose;
  const { functionList, invoke } = await getFuncList({
    getFunctionList: true,
    functionDir: options.functionDir,
    sourceDir: options.sourceDir,
    verbose: options.verbose,
  });
  const invokeHTTPData: Partial<{
    headers: any;
    body: string;
    method: string;
    path: string;
    url: string;
    query: any;
    base64Encoded: boolean;
    pathParameters: {
      [name: string]: string;
    };
  }> = {};
  // 获取路由
  let urlMatchList = [];
  Object.keys(functionList).forEach(functionName => {
    const functionItem = functionList[functionName] || {};
    const httpEvents = (functionItem.events || []).filter((eventItem: any) => {
      return eventItem.http || eventItem.apigw;
    });

    for (const event of httpEvents) {
      const eventItem = event?.http || event?.apigw;
      if (eventItem) {
        const router = eventItem.path?.replace(/\/\*$/, '/(.*)?') || '/(.*)?';
        urlMatchList.push({
          functionName,
          functionHandler: functionItem.handler,
          router,
          originRouter: eventItem.path || '/*',
          pureRouter: eventItem.path?.replace(/\/\*$/, '/') || '/',
          level: router.split('/').length - 1,
          paramsMatchLevel: router.indexOf('/:') !== -1 ? 1 : 0,
          method: (eventItem.method ? [].concat(eventItem.method) : []).map(
            method => {
              return method.toLowerCase();
            }
          ),
        });
      }
    }
  });
  // 1. 绝对路径规则优先级最高如 /ab/cb/e
  // 2. 星号只能出现最后且必须在/后面，如 /ab/cb/**
  // 3. 如果绝对路径和通配都能匹配一个路径时，绝对规则优先级高
  // 4. 有多个通配能匹配一个路径时，最长的规则匹配，如 /ab/** 和 /ab/cd/** 在匹配 /ab/cd/f 时命中 /ab/cd/**
  // 5. 如果 / 与 /* 都能匹配 / ,但 / 的优先级高于 /*
  urlMatchList = urlMatchList.sort((handlerA, handlerB) => {
    if (handlerA.level === handlerB.level) {
      if (handlerA.pureRouter === handlerB.pureRouter) {
        return handlerA.router.length - handlerB.router.length;
      }
      if (handlerA.paramsMatchLevel === handlerB.paramsMatchLevel) {
        return handlerB.pureRouter.length - handlerA.pureRouter.length;
      }
      return handlerA.paramsMatchLevel - handlerB.paramsMatchLevel;
    }
    return handlerB.level - handlerA.level;
  });
  let matchRes;
  const functionItem = urlMatchList.find(item => {
    matchRes = match(item.router)(currentUrl);
    if (matchRes) {
      if (item.method.length && item.method.indexOf(currentMethod) === -1) {
        return false;
      }
      // 如果不在白名单内，并且是需要被忽略的函数，则跳过函数处理
      if (
        !ignoreWildcardFunctionsWhiteList.includes(currentUrl) &&
        options.ignoreWildcardFunctions?.includes(item.functionName)
      ) {
        // 中后台 webpack 的特殊处理，忽略特定函数的通配逻辑
        return currentUrl.indexOf(item.originRouter) !== -1;
      }
      return true;
    }
  });

  if (functionItem?.functionName) {
    // 匹配到了函数
    invokeOptions.functionName = functionItem.functionName;
    invokeOptions.functionHandler = functionItem.functionHandler;
    // 构造参数
    invokeHTTPData.headers = req.headers;

    if (req.body) {
      const contentType = invokeHTTPData.headers['content-type'] || '';
      if (contentType.startsWith('application/x-www-form-urlencoded')) {
        invokeHTTPData.body = qs.stringify(req.body);
      } else if (contentType.startsWith('multipart/form-data')) {
        if (req.pipe) {
          req.body = await getRawBody(req);
        }
        invokeHTTPData.body = req.body;
      } else if (
        contentType.startsWith('application/json') ||
        typeof req.body !== 'string'
      ) {
        invokeHTTPData.body = JSON.stringify(req.body);
      }
    } else {
      invokeHTTPData.body = undefined;
    }
    invokeHTTPData.method = req.method;
    invokeHTTPData.pathParameters = matchRes.params || {};
    invokeHTTPData.path = currentUrl;
    invokeHTTPData.url = req.url;
    invokeHTTPData.query = getQuery(req);
    invokeHTTPData.base64Encoded = false;
    invokeOptions.data = [invokeHTTPData];
  }

  return {
    invokeOptions,
    invokeFun: invoke,
  };
}
