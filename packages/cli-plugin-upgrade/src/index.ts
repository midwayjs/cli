import {
  BasePlugin,
  findNpmModule,
  formatModuleVersion,
} from '@midwayjs/command-core';
import { existsSync, readFileSync } from 'fs-extra';
import { join } from 'path';
import { MidwayFramework, midwayFrameworkInfo } from './constants';

export class UpgradePlugin extends BasePlugin {
  projectInfo = {
    cwd: process.cwd(),
    pkg: {
      file: '',
      data: {},
    },
    framework: MidwayFramework.Unknown,
    frameworkInfo: null,
    withServerlessYml: false,
    hooksInfo: null,
    intergrationInfo: null,
    midwayTsSourceRoot: '',
  };

  commands = {
    upgrade: {
      usage: 'upgrade to new version',
      lifecycleEvents: ['projectInfo', 'common', 'upgrade'],
    },
  };

  hooks = {
    'upgrade:projectInfo': this.getProjectInfo.bind(this),
  };

  async getProjectInfo() {
    const cwd = (this.projectInfo.cwd = this.getCwd());
    const pkgFile = join(process.cwd(), 'package.json');
    if (!pkgFile) {
      return;
    }

    const pkgJson = JSON.parse(readFileSync(pkgFile, 'utf-8'));
    this.projectInfo.pkg = {
      file: pkgFile,
      data: pkgJson,
    };

    const framework = midwayFrameworkInfo.find(frameworkInfo => {
      this.projectInfo.frameworkInfo = this.getModuleVersion(
        frameworkInfo.module
      );
      return this.projectInfo.frameworkInfo;
    });

    if (!framework) {
      return;
    }

    this.projectInfo.framework = framework.type;
    this.projectInfo.withServerlessYml = existsSync(join(cwd, 'f.yml'));

    // midway hooks 支持
    const midwayConfig = [
      join(cwd, 'midway.config.ts'),
      join(cwd, 'midway.config.js'),
    ].find(file => existsSync(file));
    if (midwayConfig) {
      const modInfo =
        findNpmModule(cwd, '@midwayjs/hooks/internal') ||
        findNpmModule(cwd, '@midwayjs/hooks-core');
      if (modInfo) {
        const { getConfig } = require(modInfo);
        const config = getConfig(cwd);
        if (config.source) {
          this.projectInfo.midwayTsSourceRoot = config.source;
        }
      }
      this.projectInfo.hooksInfo = this.getModuleVersion(modInfo);
    } else {
      this.projectInfo.hooksInfo = ['@midwayjs/hooks']
        .map(moduleName => {
          return this.getModuleVersion(moduleName);
        })
        .find(versionInfo => !!versionInfo);
    }

    this.projectInfo.intergrationInfo =
      existsSync(join(cwd, 'src/apis')) &&
      ['react', 'rax']
        .map(moduleName => {
          return this.getModuleVersion(moduleName);
        })
        .find(versionInfo => !!versionInfo);

    if (!this.projectInfo.midwayTsSourceRoot) {
      this.projectInfo.midwayTsSourceRoot = join(cwd, 'src');
      if (this.projectInfo.intergrationInfo) {
        this.projectInfo.midwayTsSourceRoot = join(cwd, 'src/apis');
      }
    }
    this.core.debug('projectInfo', this.projectInfo);
  }

  private getCwd() {
    return this.core.config?.servicePath || this.core.cwd || process.cwd();
  }

  private getModuleVersion(moduleName: string) {
    const pkgJson = this.projectInfo.pkg.data as any;
    const cwd = this.projectInfo.cwd;
    if (existsSync(join(cwd, 'node_modules'))) {
      try {
        const modulePkgJson = require.resolve(moduleName + '/package.json', {
          paths: [cwd],
        });
        const pkg = JSON.parse(readFileSync(modulePkgJson, 'utf-8'));
        return formatModuleVersion(pkg.version);
      } catch {
        //
      }
    }
    const version =
      pkgJson.dependencies?.[moduleName] ||
      pkgJson.devDependencies?.[moduleName];
    if (!version) {
      return;
    }
    return formatModuleVersion(version);
  }
}
