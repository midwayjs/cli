import { existsSync, readFileSync } from 'fs-extra';
import { join } from 'path';
import { findNpm, installNpm } from '../npm';

export const postInstall = async () => {
  // init cwd
  if (!process.env.INIT_CWD) {
    return;
  }
  const cwd = process.env.INIT_CWD;
  const pkgJsonFile = join(cwd, 'package.json');
  if (!existsSync(pkgJsonFile)) {
    return;
  }
  const pkg = JSON.parse(readFileSync(pkgJsonFile, 'utf-8'));
  const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
  return {
    cwd,
    pkg,
    deps,
    pkgJsonFile,
  };
};

export const postInstallModule = async (
  moduleList: { name: string; version: string }[]
) => {
  const info = await postInstall();
  if (!info) {
    return;
  }
  const { cwd, pkg } = info;
  const npm = findNpm().cmd;
  for (const { name, version } of moduleList) {
    if (pkg?.dependencies?.[name] || pkg?.devDependencies?.[name]) {
      continue;
    }
    console.log('[midway] auto install', name);
    await installNpm({
      baseDir: cwd,
      register: npm,
      moduleName: name + '@' + version,
      slience: true,
    });
  }
  console.log('[midway] auto install complete');
  return;
};
