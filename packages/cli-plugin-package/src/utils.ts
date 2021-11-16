import { join } from 'path';
import * as globby from 'globby';
import { unlink, existsSync, stat, readFileSync } from 'fs-extra';
import { findNpmModule } from '@midwayjs/command-core';
import * as semver from 'semver';
interface Ilayer {
  [extName: string]: {
    path: string;
  };
}

export function formatLayers(...multiLayers: Ilayer[]) {
  const layerTypeList = { npm: {}, oss: {} };
  multiLayers.forEach((layer: Ilayer) => {
    Object.keys(layer || {}).forEach(layerName => {
      if (!layer[layerName] || !layer[layerName].path) {
        return;
      }
      const [type, path] = layer[layerName].path.split(':');
      if (!layerTypeList[type]) {
        return;
      }
      layerTypeList[type][layerName] = path;
    });
  });
  return layerTypeList;
}

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

export const uselessFilesMatch = [
  '**/*.md',
  '**/*.markdown',
  '**/LICENSE',
  '**/license',
  '**/LICENSE.txt',
  '**/MIT-LICENSE.txt',
  '**/LICENSE-MIT.txt',
  '**/*.d.ts',
  '**/*.ts.map',
  '**/*.js.map',
  '**/*.test.js',
  '**/*.test.ts',
  '**/travis.yml',
  '**/.travis.yml',
  '**/src/**/*.ts',
  '**/test/',
  '**/tests/',
  '**/coverage/',
  '**/.github/',
  '**/.coveralls.yml',
  '**/.npmignore',
  '**/AUTHORS',
  '**/HISTORY',
  '**/Makefile',
  '**/.jshintrc',
  '**/.eslintrc',
  '**/.eslintrc.json',
  '**/@types/',
  '**/.mwcc-cache/',
];

export const removeUselessFiles = async (target: string) => {
  const nm = join(target, 'node_modules');
  const list = await globby(uselessFilesMatch, {
    cwd: nm,
    deep: 10,
  });
  console.log('  - Useless files Count', list.length);
  let size = 0;
  for (const file of list) {
    const path = join(nm, file);
    if (existsSync(path)) {
      const stats = await stat(path);
      size += stats.size;
      await unlink(path);
    }
  }
  console.log(
    `  - Remove Useless file ${Number(size / (2 << 19)).toFixed(2)} MB`
  );
};

// 分析装饰器上面的函数信息
export const analysisDecorator = async (cwd: string, currentFunc?) => {
  const midwayCoreMod = findNpmModule(cwd, '@midwayjs/core');
  const { ServerlessTriggerCollector } = require(midwayCoreMod);
  const collector = new ServerlessTriggerCollector(cwd);
  const result = await collector.getFunctionList();
  const allFunc = currentFunc || {};
  if (Array.isArray(result)) {
    result.forEach(func => {
      if (!func.functionTriggerName) {
        return;
      }
      const handler = func.funcHandlerName;
      if (
        !handler ||
        func.functionName.includes('undefined') ||
        func.handlerName.includes('undefined')
      ) {
        return;
      }

      if (!func.functionTriggerMetadata) {
        func.functionTriggerMetadata = {};
      }

      const funcName =
        func.functionMetadata?.functionName ||
        func.functionTriggerMetadata?.functionName ||
        func.functionName ||
        handler.replace(/[^\w]/g, '-');
      if (!allFunc[funcName]) {
        allFunc[funcName] = {
          handler,
          events: [],
        };
      }

      Object.assign(allFunc[funcName], func.functionMetadata);

      delete allFunc[funcName].functionName;

      if (!allFunc[funcName].events) {
        allFunc[funcName].events = [];
      }

      if (!allFunc[funcName].handler) {
        allFunc[funcName].handler = handler;
      }

      delete func.functionTriggerMetadata.functionName;
      delete func.functionTriggerMetadata.middware;

      const trigger = func.functionTriggerName;
      let isAddToTrigger = false;
      if (trigger === 'http') {
        const { path, method } = func.functionTriggerMetadata;
        let methodList = [].concat(method || []);
        if (methodList.includes('any') || methodList.includes('all')) {
          func.functionTriggerMetadata.method = 'any';
          methodList = ['any'];
        } else {
          func.functionTriggerMetadata.method = methodList;
        }
        // 避免重复路径创建多个trigger
        const httpTrigger = allFunc[funcName].events.find(event => {
          return !!event.http && event.http.path === path;
        });
        if (httpTrigger) {
          if (
            httpTrigger.http.method === 'any' ||
            func.functionTriggerMetadata.method === 'any'
          ) {
            httpTrigger.http.method = 'any';
          } else {
            httpTrigger.http.method = [].concat(httpTrigger.http.method || []);
            if (method) {
              [].concat(method).forEach(methodItem => {
                if (!httpTrigger.http.method.includes(methodItem)) {
                  httpTrigger.http.method.push(methodItem);
                }
              });
            }
          }
          isAddToTrigger = true;
        }
      }

      if (!isAddToTrigger) {
        const triggerIsBoolean = !Object.keys(func.functionTriggerMetadata)
          .length;
        allFunc[funcName].events.push({
          [trigger]: triggerIsBoolean ? true : func.functionTriggerMetadata,
        });
      }
    });
  }

  let applicationContext;
  if (typeof collector?.getApplicationContext === 'function') {
    applicationContext = collector?.getApplicationContext();
  }

  return {
    funcSpec: allFunc,
    applicationContext,
  };
};

interface ModInfo {
  name: string;
  version: string;
}
export const copyFromNodeModules = async (
  moduleInfoList: ModInfo[],
  baseNodeModuleDir: string,
  fromNodeModulesPath: string,
  targetNodeModulesPath: string,
  moduleMap: { [modName: string]: { version: string; path: string } } = {}
) => {
  for (const moduleInfo of moduleInfoList) {
    const { name, version } = moduleInfo;
    if (moduleMap[name] && semver.satisfies(moduleMap[name].version, version)) {
      continue;
    }

    const info = getModuleCycleFind(
      moduleInfo.name,
      baseNodeModuleDir,
      fromNodeModulesPath
    );
    if (!info) {
      return;
    }
    const pkgJson = JSON.parse(
      readFileSync(join(info.path, 'package.json')).toString()
    );
    if (!semver.satisfies(pkgJson.version, moduleInfo.version)) {
      return;
    }
    moduleMap[moduleInfo.name] = {
      version: pkgJson.version,
      path: info.path,
    };
    const pkgDepsModuleInfoList: ModInfo[] = [];
    if (pkgJson.dependencies) {
      Object.keys(pkgJson.dependencies).map(modName => {
        const version = pkgJson.dependencies[modName];
        pkgDepsModuleInfoList.push({
          name: modName,
          version,
        });
      });
    }

    const childInfo = copyFromNodeModules(
      pkgDepsModuleInfoList,
      baseNodeModuleDir,
      join(info.path, 'node_modules'),
      targetNodeModulesPath,
      moduleMap
    );
    if (!childInfo) {
      return;
    }
  }
  return moduleMap;
};

const getModuleCycleFind = (
  moduleName,
  baseNodeModuleDir,
  fromNodeModuleDir
) => {
  while (true) {
    const modulePath = join(fromNodeModuleDir, moduleName);
    if (existsSync(modulePath)) {
      return {
        name: moduleName,
        path: modulePath,
      };
    }
    if (baseNodeModuleDir === fromNodeModuleDir) {
      return;
    }
    const parentDir = join(fromNodeModuleDir, '../');
    if (parentDir === fromNodeModuleDir) {
      return;
    }
    fromNodeModuleDir = parentDir;
  }
};
