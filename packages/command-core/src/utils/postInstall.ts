import { existsSync, readFileSync, ensureFile, writeFile } from 'fs-extra';
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
  const { registry, npm } = findNpm();
  const modules = [];
  for (const { name, version } of moduleList) {
    if (pkg?.dependencies?.[name] || pkg?.devDependencies?.[name]) {
      continue;
    }
    console.log('[midway] auto install', name);
    modules.push(name + '@' + version);
  }

  if (!modules.length) {
    return;
  }
  const installingLock = join(
    cwd,
    `node_modules/.midwayjs-cli/postInstallLock/${modules
      .join('_')
      .replace(/\//g, '_')}.lock`
  );
  if (existsSync(installingLock)) {
    return;
  }
  await ensureFile(installingLock);
  await writeFile(installingLock, JSON.stringify({ cwd, npm, registry }));
  await installNpm({
    baseDir: cwd,
    mode: ['save-dev'],
    register: ['yarn'].includes(npm) ? 'npm' : npm,
    registerPath: registry,
    moduleName: modules.join(' '),
    slience: true,
  });
  console.log('[midway] auto install complete');
  return;
};
