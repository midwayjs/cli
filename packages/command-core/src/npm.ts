import { dirname, join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { exec } from './utils/exec';
import { execSync } from 'child_process';
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
  const cwd = scope.cwd || process.cwd();
  const findNmResult = findNpmModule(cwd, npmName);
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
    moduleName: npmName,
    mode: ['production', 'no-save'],
    debugLog: scope.coreInstance.debug,
  });
  return findNpmModule(cwd, npmName);
}

interface INpmInstallOptions {
  baseDir?: string;
  register?: string;
  installCmd?: string;
  registerPath?: string;
  moduleName?: string;
  mode?: string[];
  slience?: boolean;
  isLerna?: boolean;
  debugLog?: (...args: any[]) => void;
}
// yarn: yarn add mod --dev
// npm: npm i mod --no-save
// yarn + lerna: yarn add mod --ignore-workspace-root-check
// npm + lerna: npm i mod --no-save
export async function installNpm(options: INpmInstallOptions) {
  const { baseDir, slience, debugLog } = options;
  const cmd = formatInstallNpmCommand(options);
  if (debugLog) {
    debugLog('Install npm cmd', cmd);
  }
  return exec({
    cmd,
    baseDir,
    slience,
  }).then((result: string) => {
    return result.replace(/\n$/, '').replace(/^\s*|\s*$/, '');
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

const findNpmModuleByResolve = (cwd, modName) => {
  try {
    return dirname(
      require.resolve(`${modName}/package.json`, { paths: [cwd] })
    );
  } catch (e) {
    return;
  }
};

export const findNpmModule = (cwd, modName) => {
  if ('pnp' in process.versions || process.env.npm_execpath?.includes('pnpm')) {
    return findNpmModuleByResolve(cwd, modName);
  }

  const modPath = join(cwd, 'node_modules', modName);
  if (existsSync(modPath)) {
    return modPath;
  }
  const parentCwd = join(cwd, '../');
  if (parentCwd !== cwd) {
    return findNpmModule(parentCwd, modName);
  }
};

export const resolveMidwayConfig = (cwd: string) => {
  const midwayConfig = [
    join(cwd, 'midway.config.ts'),
    join(cwd, 'midway.config.js'),
  ].some(file => existsSync(file));

  const result = {
    exist: midwayConfig,
    source: '',
  };

  if (midwayConfig) {
    const modInfo =
      findNpmModule(cwd, '@midwayjs/hooks/internal') ||
      findNpmModule(cwd, '@midwayjs/hooks-core');

    if (modInfo) {
      const { getConfig } = require(modInfo);
      const config = getConfig(cwd);
      if (config.source) {
        result.source = config.source;
      }
    }
  }

  return result;
};

// 从本地检索npm包
export const findNpm = (argv?) => {
  let npm = '';
  let registry = '';
  let ignoreRegistry = false;
  // 先找npm客户端
  if (argv?.npm) {
    npm = argv.npm;
  } else if (
    process.env.npm_config_user_agent &&
    /yarn/.test(process.env.npm_config_user_agent)
  ) {
    npm = 'yarn';
  } else if (process.env.npm_execpath) {
    if (process.env.npm_execpath.includes('yarn')) {
      npm = 'yarn';
    } else {
      const npmClient = ['tnpm', 'cnpm', 'pnpm'].find(npm =>
        process.env.npm_execpath.includes(npm)
      );
      if (npmClient) {
        npm = npmClient;
        ignoreRegistry = true;
      }
    }
  }

  if (!npm) {
    const npmList = ['pnpm', 'cnpm'];
    const currentPlatform = platform();
    const cmd = npmList.find(cmd => {
      if (currentPlatform === 'win32') {
        // for windows
        try {
          const find = execSync(`where ${cmd}`, { stdio: 'ignore' }).toString();
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

  if (!npm) {
    npm = 'npm';
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
      registry = 'https://registry.npmmirror.com';
    }
  }

  return {
    cmd: `${npm}${
      !ignoreRegistry && registry ? ` --registry=${registry}` : ''
    }`,
    npm,
    registry: !ignoreRegistry ? registry : '',
  };
};

// 转换npm安装命令
export const formatInstallNpmCommand = (options: INpmInstallOptions) => {
  const { register = 'npm', moduleName, registerPath, isLerna } = options;
  let { installCmd = 'i', mode } = options;
  if (!mode?.length) {
    mode = ['no-save'];
  }
  if (/yarn/.test(register)) {
    // yarn add
    if (!moduleName) {
      installCmd = 'install';
      mode.push('no-lockfile');
      if (mode.includes('production')) {
        mode.push('ignore-optional');
      }
    } else {
      installCmd = 'add';
    }
    if (!mode?.length) {
      mode = [isLerna ? 'ignore-workspace-root-check' : 'dev'];
    }
    mode = mode.map(modeItem => {
      if (modeItem === 'no-save') {
        return 'optional';
      }
      if (modeItem === 'save-dev') {
        return 'dev';
      }
      return modeItem;
    });
  } else if (/^pnpm/.test(register)) {
    if (!moduleName) {
      installCmd = 'install';
      if (mode.includes('production')) {
        mode = ['prod', 'no-optional'];
      }
    } else {
      installCmd = 'add';
      mode = mode.map(modeItem => {
        if (modeItem === 'no-save') {
          return 'save-optional';
        }
        if (modeItem === 'save-dev') {
          return modeItem;
        }
        return '';
      });
    }
  } else {
    // npm
    const isProduction = mode.find(modeItem => {
      return modeItem === 'production';
    });
    if (!isProduction) {
      mode.push('legacy-peer-deps');
    }
  }
  const cmd = `${register} ${installCmd}${
    moduleName ? ` ${moduleName}` : ''
  }${mode
    .map(modeItem => {
      if (!modeItem) return '';
      return ` --${modeItem}`;
    })
    .join('')}${registerPath ? ` --registry=${registerPath}` : ''}`;
  return cmd;
};

export const formatModuleVersion = (version?) => {
  let major = '',
    minor = '',
    patch = '';
  if (typeof version === 'string') {
    if (['beta', 'latest', 'alpha'].includes(version)) {
      major = version;
    } else if (/^(\^)?(\d+)(\.|$)/.test(version)) {
      const versionList = version.replace(/^\^/, '').split('.');
      major = versionList[0];
      minor = versionList[1] || '';
      patch = versionList[2] || '';
    }
  }
  return {
    major,
    minor,
    patch,
  };
};

export const findMidwayVersion = (cwd): any => {
  let pkg: any = {};
  try {
    const pkgJsonPath = join(cwd, 'package.json');
    if (existsSync(pkgJsonPath)) {
      pkg = JSON.parse(readFileSync(pkgJsonPath).toString());
    }
  } catch {
    //
  }
  const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
  const modules = [
    '@midwayjs/faas',
    '@midwayjs/koa',
    '@midwayjs/express',
    '@midwayjs/web',
  ];
  const module = modules.find(module => deps[module]);
  return {
    module,
    version: formatModuleVersion(deps[module]) || {},
  };
};
