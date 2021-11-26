import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { PluginList } from './plugins';
import { findNpm } from '@midwayjs/command-core';
import { installNpm } from '@midwayjs/command-core';
const matchReg = /(?:^|\s)(?:midway-bin|mw)\s+([a-z]+?)(?:\s|$)/i;
export const postinstall = async (baseDir: string) => {
  const pkgJson = getPkgJson(baseDir);
  const pkgJsonList = [];
  if (pkgJson) {
    pkgJsonList.push(pkgJson);
  }
  let isLerna = false;
  // lerna support
  if (existsSync(join(baseDir, 'lerna.json'))) {
    const lernaPackagesJson = getLernaPackagesJson();
    pkgJsonList.push(...lernaPackagesJson);
    isLerna = true;
  }
  const modMap = {};
  const installedModMap = {};
  pkgJsonList.forEach(pkgJson => {
    if (!pkgJson) {
      return;
    }
    Object.assign(
      installedModMap,
      pkgJson.dependencies,
      pkgJson.devDependencies
    );
    if (pkgJson.scripts) {
      Object.keys(pkgJson.scripts).forEach(script => {
        const cmd = pkgJson.scripts[script];
        cmdToMod(cmd, modMap, installedModMap);
      });
    }
  });

  const allMods = Object.keys(modMap);
  const npm = findNpm().cmd;
  for (const name of allMods) {
    console.log('[midway] auto install', name);
    await installNpm({
      baseDir,
      register: npm,
      moduleName: name,
      slience: true,
      isLerna,
    });
  }
  console.log('[midway] auto install complete');
};

const cmdToMod = (cmd: string, modMap, installedModMap) => {
  if (matchReg.test(cmd)) {
    const command = matchReg.exec(cmd)[1];
    const mod = PluginList.filter(plugin => {
      return !plugin.installed && plugin.command === command;
    });
    if (Array.isArray(mod) && mod.length) {
      mod.forEach(modInfo => {
        const modName = modInfo.mod;
        if (installedModMap[modName]) {
          return;
        }
        if (!modMap[modName]) {
          modMap[modName] = true;
        }
      });
    }
  }
};

const getLernaPackagesJson = () => {
  const pkgJsonList = [];
  try {
    const originData = execSync('npx lerna ls --json').toString();
    const packageInfoList = JSON.parse(originData);
    packageInfoList.forEach(packageInfo => {
      const pkgJson = getPkgJson(packageInfo.location);
      if (pkgJson) {
        pkgJsonList.push(pkgJson);
      }
    });
  } catch {
    // ignore
  }
  return pkgJsonList;
};

const getPkgJson = (dirPath: string) => {
  const pkgFile = join(dirPath, 'package.json');
  if (!existsSync(pkgFile)) {
    return;
  }
  return JSON.parse(readFileSync(pkgFile).toString());
};
