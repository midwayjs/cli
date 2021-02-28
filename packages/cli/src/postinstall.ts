import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { PluginList } from './plugins';
import { findNpm } from './utils';
import { installNpm } from '@midwayjs/command-core';
export const postinstall = async (baseDir: string) => {
  const pkgJson = getPkgJson(baseDir);
  const scripts = pkgJson.scripts;
  const matchReg = /\smidway-bin\s+([a-z]+?)(?:\s|$)/i;
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
          if (!modMap[modInfo.mod]) {
            modMap[modInfo.mod] = true;
          }
        });
      }
    }
  });
  const allMods = Object.keys(modMap);
  const npm = process.env.NPM_CLIENT || findNpm().cmd;
  for (const name of allMods) {
    console.log('[midway] auto install cli plugin', name);
    await installNpm({
      baseDir,
      register: npm,
      npmName: name,
      slience: true,
    });
  }
  console.log('[midway] cli plugin install complete');
};

const getPkgJson = (dirPath: string) => {
  const pkgFile = join(dirPath, 'package.json');
  if (!existsSync(pkgFile)) {
    return {};
  }
  return JSON.parse(readFileSync(pkgFile).toString());
};

if (process.env.INIT_CWD) {
  postinstall(process.env.INIT_CWD);
}
