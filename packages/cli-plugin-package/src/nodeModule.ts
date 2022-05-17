import { exec, exists } from '@midwayjs/command-core';
import { copy, readFile } from 'fs-extra';
import { platform } from 'os';
import { join } from 'path';
import * as semver from 'semver';
import { ModInfo } from './interface';

export const copyFromNodeModules = async (
  moduleInfoList: ModInfo[],
  fromNodeModulesPath: string,
  targetNodeModulesPath: string
) => {
  const moduleMap = await findModuleFromNodeModules(
    moduleInfoList,
    fromNodeModulesPath,
    fromNodeModulesPath
  );
  if (!moduleMap) {
    return;
  }
  const moduleNames = Object.keys(moduleMap);
  const result = await Promise.all(
    moduleNames.map(async name => {
      const { path } = moduleMap[name];
      const target = join(targetNodeModulesPath, name);
      await copy(path, target, {
        dereference: true,
        filter: src => {
          if (src.endsWith('/node_modules')) {
            return false;
          }
          return true;
        },
      });
      return name;
    })
  );
  return result;
};

export const findModuleFromNodeModules = async (
  moduleInfoList: ModInfo[],
  baseNodeModuleDir: string,
  fromNodeModulesPath: string,
  moduleMap: { [modName: string]: { version: string; path: string } } = {}
) => {
  for (const moduleInfo of moduleInfoList) {
    const { name, version } = moduleInfo;
    if (moduleMap[name] && semver.satisfies(moduleMap[name].version, version)) {
      continue;
    }

    const modulePath = join(fromNodeModulesPath, moduleInfo.name);
    let info = {
      path: modulePath,
    };
    let pkgJson: any = {};
    if (await exists(modulePath)) {
      pkgJson = JSON.parse(
        await readFile(join(info.path, 'package.json')).toString()
      );
    } else {
      info = await getModuleCycleFind(
        moduleInfo.name,
        baseNodeModuleDir,
        fromNodeModulesPath
      );
      if (!info) {
        return;
      }
      pkgJson = JSON.parse(
        await readFile(join(info.path, 'package.json')).toString()
      );
      if (!semver.satisfies(pkgJson.version, moduleInfo.version)) {
        return;
      }
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

    const childInfo = await findModuleFromNodeModules(
      pkgDepsModuleInfoList,
      baseNodeModuleDir,
      join(info.path, 'node_modules'),
      moduleMap
    );
    if (!childInfo) {
      return;
    }
  }
  return moduleMap;
};

const getModuleCycleFind = async (
  moduleName,
  baseNodeModuleDir,
  fromNodeModuleDir
) => {
  while (true) {
    const modulePath = join(fromNodeModuleDir, moduleName);
    if (await exists(modulePath)) {
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

export const biggestDep = async (midwayBuildPath, log) => {
  if (platform() === 'win32') {
    return;
  }
  let sizeRes;
  try {
    sizeRes = await exec({
      cmd: 'du -hs * | sort -h',
      baseDir: join(midwayBuildPath, 'node_modules'),
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
  log(' - Biggest Dependencies list:');
  biggestModList
    .slice(-5)
    .reverse()
    .forEach(modInfo => {
      log(`    ${modInfo.size}\t${modInfo.name}`);
    });
};
