import execa from 'execa';
import jsonfile from 'jsonfile';
import prettier from 'prettier';
import path from 'path';
import fs from 'fs-extra';
import findUp from 'find-up';
import consola from 'consola';
import chalk from 'chalk';

export const getNearestPackageFile = (cwd?: string) => {
  return findUp.sync('package.json', {
    type: 'file',
    cwd,
  });
};

export type DepRecord = Record<
  'dependencies' | 'devDependencies',
  Record<string, string>
>;

export type ScriptRecord = Record<string, string>;

export type NPMScriptMap = {
  script: string;
  content: string;
};

export const addNPMScripts = (pkgPath: string, scriptMap: NPMScriptMap[]) => {
  let existScriptMap: ScriptRecord = {};
  let originContentObj: Record<string, any> = {};
  const originContent = fs.readFileSync(pkgPath, 'utf-8');

  try {
    originContentObj = JSON.parse(originContent);
    existScriptMap = originContentObj['scripts'];
  } catch (error) {
    existScriptMap = {};
  }

  const existScriptKeys = Object.keys(existScriptMap);

  const validScripts = scriptMap
    // .map(script => script.script)
    .filter(script => !existScriptKeys.includes(script.script));

  const validScriptObject: ScriptRecord = {};

  for (const scriptKey of validScripts) {
    validScriptObject[scriptKey.script] = scriptKey.content;
  }

  const updatedScriptMap = {
    ...existScriptMap,
    ...validScriptObject,
  };

  originContentObj['scripts'] = updatedScriptMap;

  fs.writeFileSync(
    pkgPath,
    prettier.format(JSON.stringify(originContentObj), { parser: 'json' })
  );
};

export const checkDepExist = (dep: string, cwd = process.cwd()) => {
  const pkg: DepRecord = JSON.parse(
    fs.readFileSync(getNearestPackageFile(cwd), 'utf-8')
  );
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  return Object.keys(allDeps).includes(dep);
};

// deps only
export const ensureDepsInstalled = async (
  depOrDeps: string | string[],
  cwd = process.cwd()
) => {
  consola.info(`Checking dependencies...`);

  const depsArr = Array.isArray(depOrDeps) ? depOrDeps : [depOrDeps];

  const missingDeps = depsArr.filter(dep => !checkDepExist(dep, cwd));

  if (!missingDeps.length) {
    consola.success(`dependencies Installed.`);

    return;
  }

  consola.info(
    `Installing missing deps: ${chalk.cyan(missingDeps.join(', '))} ...`
  );

  await installDep(missingDeps, false, cwd);
};

// devDeps only
export const ensureDevDepsInstalled = async (
  depOrDeps: string | string[],
  cwd = process.cwd()
) => {
  consola.info(`Checking devDependencies...`);

  const depsArr = Array.isArray(depOrDeps) ? depOrDeps : [depOrDeps];

  const missingDeps = depsArr.filter(dep => !checkDepExist(dep, cwd));

  if (!missingDeps.length) {
    consola.success(`devDependencies Installed.`);

    return;
  }

  consola.info(
    `Installing missing deps: ${chalk.cyan(missingDeps.join(', '))} ...`
  );

  await installDep(missingDeps, true, cwd);
};

export const installDep = async (
  dep: string | string[],
  asDevDeps = false,
  cwd = process.cwd()
) => {
  try {
    const manager = getManager();
    const command = `${manager} ${
      manager === 'yarn' ? 'add' : 'install'
    } ${(Array.isArray(dep) ? dep : [dep]).join(' ')} ${
      asDevDeps ? '--save-dev' : '--save'
    }`;

    await execa(command, {
      stdio: 'inherit',
      preferLocal: true,
      shell: true,
      cwd,
    });
    consola.success('Installation succeed.\n');
  } catch (error) {
    consola.fatal('Installation failed.\n');
    throw error;
  }
};

type PkgManager = 'npm' | 'yarn';

export const getManager = (cwd?: string): PkgManager => {
  return findUp.sync('yarn.lock', {
    type: 'file',
    cwd,
  })
    ? 'yarn'
    : 'npm';
};
