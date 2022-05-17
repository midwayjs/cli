import { findNpmModule } from '@midwayjs/command-core';
import { access, stat, copy, unlink, readFile, writeFile } from 'fs-extra';
import * as globby from 'globby';
import * as plimit from 'p-limit';
import { isAbsolute, join, relative } from 'path';
import { ICopyOptions } from './interface';
export const transformPathToRelative = (baseDir: string, targetDir: string) => {
  if (targetDir) {
    if (isAbsolute(targetDir)) {
      return relative(baseDir, targetDir);
    }
    return targetDir;
  }
};

export const transformPathToAbsolute = (baseDir: string, targetDir: string) => {
  if (targetDir) {
    if (isAbsolute(targetDir)) {
      return targetDir;
    }
    return join(baseDir, targetDir);
  }
};

export const exists = async (path: string) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

export const DefaultLockFiles = [
  'yarn.lock',
  'package-lock.json',
  'pnpm-lock.yaml',
];

export const copyFiles = async (options: ICopyOptions) => {
  const { defaultInclude, include, exclude, sourceDir, targetDir, log } =
    options;
  const paths = await globby(
    (
      defaultInclude || ['*.yml', '*.js', '*.ts', '*.json', 'app', 'config']
    ).concat(include || []),
    {
      cwd: sourceDir,
      followSymbolicLinks: false,
      ignore: [
        '**/node_modules/**', // 模块依赖目录
        '**/test/**', // 测试目录
        '**/run/**', // egg 运行调试目录
        '**/.serverless/**', // faas 构建目录
        '**/.faas_debug_tmp/**', // faas 调试临时目录
      ].concat(exclude || []),
    }
  );
  await docopy(sourceDir, targetDir, paths, log);
};

export const copyStaticFiles = async ({ sourceDir, targetDir }) => {
  if (!sourceDir || !targetDir) {
    return;
  }
  const paths = globby.sync(['**/*.*'], {
    cwd: sourceDir,
    followSymbolicLinks: false,
    ignore: [
      '**/*.ts',
      '**/node_modules/**', // 模块依赖目录
    ],
  });
  return docopy(sourceDir, targetDir, paths);
};

const docopy = async (
  sourceDir: string,
  targetDir: string,
  paths: string[],
  log?
) => {
  const limit = plimit(20);
  await Promise.all(
    paths.map((path: string) => {
      return limit(async () => {
        const source = join(sourceDir, path);
        const target = join(targetDir, path);
        if (await exists(target)) {
          const sourceStat = await stat(source);
          const targetStat = await stat(target);
          // source 修改时间小于目标文件 修改时间，则不拷贝
          if (sourceStat.mtimeMs <= targetStat.mtimeMs) {
            return;
          }
        }
        if (log) {
          log(path);
        }

        return copy(source, target).catch(e => {
          if (log) {
            log(`Error!!! From '${source}' to '${target}'`, e);
          }
        });
      });
    })
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
    if (await exists(path)) {
      const stats = await stat(path);
      size += stats.size;
      await unlink(path);
    }
  }
  console.log(
    `  - Remove Useless file ${Number(size / (2 << 19)).toFixed(2)} MB`
  );
};

export const readJson = async (path: string) => {
  if (await exists(path)) {
    return JSON.parse(await readFile(path, 'utf-8'));
  }
  return {};
};

// 格式化 ts 配置文件
export const formatTsConfig = async (tsconfigJsonFile: string) => {
  const tsconfigJson = await readJson(tsconfigJsonFile);
  if (!tsconfigJson.compilerOptions) {
    tsconfigJson.compilerOptions = {};
  }
  Object.assign(tsconfigJson.compilerOptions, {
    target: 'es2018',
    module: 'commonjs',
    outDir: './dist',
    rootDir: 'src',
    experimentalDecorators: true,
  });
  if (!tsconfigJson.include?.length) {
    tsconfigJson.include = ['src'];
  }
  await writeFile(tsconfigJsonFile, JSON.stringify(tsconfigJson, null, 2));
  return tsconfigJson;
};
