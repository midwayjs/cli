import { join } from 'path';
import { existsSync, writeFileSync } from 'fs';
import { exec, execSync } from 'child_process';
import * as assert from 'assert';
export const getCoreBaseDir = () => {
  return execSync('npm root').toString().replace(/\n$/, '');
};

async function getNpmPath(
  scope: any,
  npmName: string,
  npmRegistry?: string
): Promise<string> {
  const findNmResult = findNpmModule(scope.cwd || process.cwd(), npmName);
  if (findNmResult) {
    return findNmResult;
  }
  const currentNodeModules = getCoreBaseDir();
  const localNpmPath = join(currentNodeModules, npmName);
  if (existsSync(localNpmPath)) {
    return localNpmPath;
  }

  let baseDir = join(currentNodeModules, '../');
  if (!existsSync(baseDir)) {
    baseDir = process.cwd();
  }
  const pkgJson = join(baseDir, 'package.json');
  if (!existsSync(pkgJson)) {
    writeFileSync(pkgJson, '{}');
  }
  scope.coreInstance.cli.log(`Installing ${npmName}`);
  await installNpm({
    baseDir,
    register: npmRegistry,
    npmName,
    mode: 'production --no-save',
  });
  return join(baseDir, `node_modules/${npmName}`);
}

interface INpmInstallOptions {
  baseDir?: string;
  register?: string;
  installCmd?: string;
  registerPath?: string;
  npmName: string;
  mode?: string;
  slience?: boolean;
}
export async function installNpm(options: INpmInstallOptions) {
  const { baseDir, register = 'npm', npmName, slience, registerPath } = options;
  let { installCmd = 'i', mode } = options;
  if (/yarn/.test(register)) {
    if (installCmd === 'i') {
      // yarn add
      installCmd = 'add';
      if (!mode) {
        mode = 'ignore-workspace-root-check';
      }
    }
  }
  const cmd = `${register} ${installCmd} ${npmName}${
    mode ? ` --${mode}` : ' --no-save'
  }${registerPath ? ` --registry=${registerPath}` : ''}`;

  return new Promise((resolved, rejected) => {
    const execProcess = exec(
      cmd,
      {
        cwd: baseDir,
      },
      (err, result) => {
        if (err) {
          return rejected(err);
        }
        resolved(result.replace(/\n$/, '').replace(/^\s*|\s*$/, ''));
      }
    );
    execProcess.stdout.on('data', data => {
      if (!slience) {
        console.log(data);
      }
    });
  });
}

export async function loadNpm(
  scope: any,
  npmName: string,
  npmRegistry?: string
) {
  try {
    const npmPath = await getNpmPath(scope, npmName, npmRegistry);
    assert(npmPath, 'empty npm path');
    const plugin = require(npmPath);
    scope.addPlugin(plugin);
  } catch (e) {
    // scope.error('npmPlugin', { npmName, err: e });
  }
}

export const findNpmModule = (cwd, modName) => {
  const modPath = join(cwd, 'node_modules', modName);
  if (existsSync(modPath)) {
    return modPath;
  }
  const parentCwd = join(cwd, '../');
  if (parentCwd !== cwd) {
    return findNpmModule(parentCwd, modName);
  }
};
