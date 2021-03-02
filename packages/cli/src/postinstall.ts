import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { PluginList } from './plugins';
import { findNpm } from './utils';
import { installNpm } from '@midwayjs/command-core';
export const postinstall = async (baseDir: string) => {
  const pkgJson = getPkgJson(baseDir);
  const scripts = pkgJson.scripts;
  const matchReg = /(?:^|\s)(?:midway-bin|mw)\s+([a-z]+?)(?:\s|$)/i;
  const modMap = {};
  Object.keys(scripts).forEach(script => {
    const cmd = scripts[script];
    if (matchReg.test(cmd)) {
      const command = matchReg.exec(cmd)[1];
      const mod = PluginList.filter(plugin => {
        return plugin.command === command;
      });
      if (Array.isArray(mod) && mod.length) {
        mod.forEach(modInfo => {
          const modName = modInfo.mod;
          if (
            pkgJson.dependencies?.[modName] ||
            pkgJson.devDependencies?.[modName]
          ) {
            return;
          }
          if (!modMap[modName]) {
            modMap[modName] = true;
          }
        });
      }
    }
  });
  const allMods = Object.keys(modMap);
  const npm = process.env.NPM_CLIENT || findNpm().cmd;
  console.log('[midway] postinstall npm client ', npm);
  for (const name of allMods) {
    console.log('[midway] auto install', name);
    await installNpm({
      baseDir,
      register: npm,
      npmName: name,
      slience: true,
    });
  }
  console.log('[midway] auto install complete');
};

const getPkgJson = (dirPath: string) => {
  const pkgFile = join(dirPath, 'package.json');
  if (!existsSync(pkgFile)) {
    return {};
  }
  return JSON.parse(readFileSync(pkgFile).toString());
};
