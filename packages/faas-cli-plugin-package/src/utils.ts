import { join } from 'path';
import * as globby from 'globby';
import { unlink, existsSync, stat } from 'fs-extra';
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

export const removeUselessFiles = async (target: string) => {
  const matchList = [
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
  ];
  const nm = join(target, 'node_modules');
  const list = await globby(matchList, {
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
