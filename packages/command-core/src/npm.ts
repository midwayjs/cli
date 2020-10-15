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
    mode: 'production',
  });
  return join(baseDir, `node_modules/${npmName}`);
}

interface INpmInstallOptions {
  baseDir?: string;
  register?: string;
  registerPath?: string;
  npmName: string;
  mode?: string;
  slience?: boolean;
}
export async function installNpm(options: INpmInstallOptions) {
  const {
    baseDir,
    register = 'npm',
    npmName,
    mode,
    slience,
    registerPath,
  } = options;
  const cmd = `${baseDir ? `cd ${baseDir} && ` : ''}${register} i ${npmName}${
    mode ? ` --${mode}` : ' --no-save'
  }${registerPath ? ` --registry=${registerPath}` : ''}`;

  return new Promise((resolved, rejected) => {
    const execProcess = exec(cmd, (err, result) => {
      if (err) {
        return rejected(err);
      }
      resolved(result.replace(/\n$/, '').replace(/^\s*|\s*$/, ''));
    });
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
    if (typeof plugin === 'object') {
      Object.keys(plugin).forEach(key => {
        scope.addPlugin(plugin[key]);
      });
      return;
    }
    scope.addPlugin(plugin);
  } catch (e) {
    scope.error('npmPlugin', { npmName, err: e });
  }
}
