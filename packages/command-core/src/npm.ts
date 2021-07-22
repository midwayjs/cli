import { join } from 'path';
import { existsSync, writeFileSync } from 'fs';
import { exec, execSync } from 'child_process';
import * as assert from 'assert';
import { platform } from 'os';
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
  isLerna?: boolean;
}
// yarn: yarn add mod --dev
// npm: npm i mod --no-save
// yarn + lerna: yarn add mod --ignore-workspace-root-check
// npm + lerna: npm i mod --no-save
export async function installNpm(options: INpmInstallOptions) {
  const {
    baseDir,
    register = 'npm',
    npmName,
    slience,
    registerPath,
    isLerna,
  } = options;
  let { installCmd = 'i', mode } = options;
  if (/yarn/.test(register)) {
    if (!options.installCmd) {
      // yarn add
      installCmd = 'add';
    }
    if (mode === undefined) {
      mode = isLerna ? 'ignore-workspace-root-check' : 'dev';
    }
  } else {
    if (mode === undefined) {
      mode = 'no-save';
    }
  }
  const cmd = `${register} ${installCmd} ${npmName}${mode ? ` --${mode}` : ''}${
    registerPath ? ` --registry=${registerPath}` : ''
  }`;

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
    if (scope && scope.debug) {
      scope.debug('Load NPM Error', e);
    }
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

export const findNpm = (argv?) => {
  let npm = 'npm';
  let registry = '';
  // 先找npm客户端
  if (argv?.npm) {
    npm = argv.npm;
  } else if (
    process.env.npm_config_user_agent &&
    /yarn/.test(process.env.npm_config_user_agent)
  ) {
    npm = 'yarn';
  } else if (
    process.env.npm_execpath &&
    /yarn/.test(process.env.npm_execpath)
  ) {
    npm = 'yarn';
  } else if (process.env.yarn_registry) {
    npm = 'yarn';
  } else {
    const npmList = ['cnpm'];
    const currentPlatform = platform();
    const cmd = npmList.find(cmd => {
      if (currentPlatform === 'win32') {
        // for windows
        try {
          const find = execSync(`where ${cmd}`).toString();
          // windows的命令路径至少会有 C/D/E:\ 前缀
          if (find.indexOf(':\\') !== -1) {
            return cmd;
          }
        } catch {
          //
        }
      } else {
        // for mac/linux
        try {
          const find = execSync(`which ${cmd}`).toString();
          // 没有找到not found
          if (find.indexOf('not found') === -1) {
            return cmd;
          }
        } catch {
          //
        }
      }
    });
    if (cmd) {
      npm = cmd;
    }
  }

  // registry
  if (argv?.registry !== undefined) {
    registry = argv.registry || '';
  } else if (npm === 'yarn' && process.env.yarn_registry) {
    registry = process.env.yarn_registry;
  } else if (process.env.npm_config_registry) {
    registry = process.env.npm_config_registry;
  } else {
    // language is zh_CN
    if (process.env.LANG === 'zh_CN.UTF-8') {
      registry = 'https://registry.npm.taobao.org';
    }
  }

  return {
    cmd: `${npm}${registry ? ` --registry=${registry}` : ''}`,
    npm,
    registry,
  };
};
