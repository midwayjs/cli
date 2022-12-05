import {
  BasePlugin,
  findNpm,
  findNpmModuleByResolve,
  installNpm,
} from '@midwayjs/command-core';
import * as enquirer from 'enquirer';
import { join, relative } from 'path';
import { existsSync, remove, readJSONSync } from 'fs-extra';
import * as chalk from 'chalk';
import { CategorySelect } from './categorySelect';
import { LightGenerator } from 'light-generator';
import Spin from 'light-spinner';

export class AddPlugin extends BasePlugin {
  private projectName = '';
  private projectDirPath = '';
  private template = '';
  private checkDepInstallTimeout;
  private templateList: any;
  commands = {
    new: {
      // mw new xxx -t
      lifecycleEvents: [
        'formatCommand',
        'generator',
        'installDep',
        'printUsage',
      ],
      options: {
        template: {
          usage: 'new template',
          shortcut: 't',
        },
        target: {
          usage: 'new project target directory',
        },
        type: {
          usage: 'new project type',
        },
        npm: {
          usage: 'npm registry',
        },
        all: {
          usage: 'show all built-in template',
          shortcut: 'a',
        },
        skipInstallDep: {
          usage: 'Skip Install Dependencies',
        },
        templateModule: {
          usage: 'Instead of @midwayjs/boilerplate-list',
        },
      },
      passingCommand: true,
    },
  };

  hooks = {
    'new:formatCommand': this.newFormatCommand.bind(this),
    'new:generator': this.generator.bind(this),
    'new:installDep': this.installDep.bind(this),
    'new:printUsage': this.printUsage.bind(this),
  };

  async newFormatCommand() {
    const { cwd } = this.core;
    this.core.debug('cwd', cwd);
    const templateModuleName =
      this.options.templateModule ||
      process.env.MIDWAY_TEMPLATE_MODULE ||
      '@midwayjs/boilerplate-list';
    if (typeof templateModuleName === 'string') {
      const templateModulePath = findNpmModuleByResolve(
        cwd,
        templateModuleName
      );
      this.core.debug('templateModulePath', templateModulePath);
      this.templateList = require(templateModulePath);
    } else {
      this.templateList = templateModuleName;
    }

    this.template = this.options.template;
    if (this.options.type) {
      this.template = this.templateList[this.options.type]?.package;
    }
    if (!this.template) {
      this.template = await this.userSelectTemplate();
    }

    if (!this.options.npm) {
      const { cmd, npm, registry } = findNpm();
      if (['yarn', 'pnpm'].includes(npm)) {
        this.options.npm = 'npm' + (registry ? ` --registry=${registry}` : '');
      } else {
        this.options.npm = cmd;
      }
    }

    const { commands } = this.core.coreOptions;
    let projectPath = this.options.target || commands[1];
    if (!projectPath) {
      projectPath = await new (enquirer as any).Input({
        message: 'What name would you like to use for the new project?',
        initial: 'midway-project',
      }).run();
    }
    this.projectName = projectPath;

    const projectDirPath = join(cwd, projectPath);
    if (existsSync(projectDirPath)) {
      const isOverwritten = await new (enquirer as any).Confirm({
        name: 'question',
        message: `The name '${projectPath}' already exists, is it overwritten?`,
        initial: true,
      }).run();
      if (!isOverwritten) {
        process.exit();
      }
      await remove(projectDirPath);
    }
    this.projectDirPath = projectDirPath;
  }

  private async generator() {
    const { projectDirPath, template } = this;
    if (!template) {
      return;
    }
    let type = 'npm';
    if (template[0] === '.' || template[0] === '/') {
      type = 'local';
    }
    this.core.debug('template', template);
    this.core.debug('projectDirPath', projectDirPath);
    this.core.debug('type', type);
    const spin = new Spin({
      text: 'Downloading Boilerplate...',
    });
    spin.start();
    try {
      const lightGenerator = new LightGenerator();
      let generator;
      if (type === 'npm') {
        // 利用 npm 包
        generator = lightGenerator.defineNpmPackage({
          npmClient: this.options.npm || 'npm',
          npmPackage: template,
          targetPath: projectDirPath,
        });
      } else {
        // 利用本地路径
        generator = lightGenerator.defineLocalPath({
          templatePath: template,
          targetPath: projectDirPath,
        });
      }
      await generator.run();
      spin.stop();
    } catch (e) {
      spin.stop();
      throw e;
    }
  }

  // 用户选择模板
  async userSelectTemplate() {
    if (!this.options.all) {
      for (const key of Object.keys(this.templateList)) {
        if (this.templateList[key]['hidden'] === true) {
          delete this.templateList[key];
        }
      }
    }
    const prompt = new CategorySelect({
      name: 'templateName',
      message: 'Hello, traveller.\n  Which template do you like?',
      groupChoices: this.templateList,
      result: value => {
        return value.split(' - ')[0];
      },
      show: true,
    });
    const type = await prompt.run();
    return this.templateList[type].package;
  }

  private async installDep() {
    if (this.options.skipInstallDep) {
      return;
    }
    await this.npmInstall(this.projectDirPath);
  }

  // 安装npm到构建文件夹
  private async npmInstall(baseDir) {
    return new Promise((resolve, reject) => {
      const installDirectory = baseDir;
      const pkgJson: string = join(installDirectory, 'package.json');
      if (!existsSync(pkgJson)) {
        return resolve(void 0);
      }
      const pkg = readJSONSync(pkgJson);
      const allDeps = Object.keys(
        Object.assign({}, pkg.devDependencies, pkg.dependencies)
      );
      const spin = new Spin({
        text: 'Dependencies installing...',
      });
      spin.start();
      this.checkDepInstalled(baseDir, spin, allDeps);
      installNpm({
        baseDir: installDirectory,
        register: this.options.npm,
        slience: true,
        debugLog: this.core.debug,
      })
        .then(() => {
          clearTimeout(this.checkDepInstallTimeout);
          spin.stop();
          resolve(true);
        })
        .catch(err => {
          const errmsg = (err && err.message) || err;
          this.core.cli.log(` - npm install err ${errmsg}`);
          clearTimeout(this.checkDepInstallTimeout);
          spin.stop();
          reject(errmsg);
        });
    });
  }

  checkDepInstalled(baseDir, spin, allDeps) {
    const nmDir = join(baseDir, 'node_modules');
    const notFind = allDeps.filter(dep => {
      return !existsSync(join(nmDir, dep));
    });
    if (!notFind.length) {
      return;
    }
    spin.text = `[${allDeps.length - notFind.length}/${
      allDeps.length
    }] Dependencies installing...`;
    clearTimeout(this.checkDepInstallTimeout);
    this.checkDepInstallTimeout = setTimeout(() => {
      this.checkDepInstalled(baseDir, spin, allDeps);
    }, 200);
  }

  printUsage() {
    console.log(
      'Successfully created project',
      chalk.hex('#3eab34')(this.projectName)
    );
    console.log('Get started with the following commands:');
    console.log('');
    console.log(
      chalk.hex('#777777')(
        `$ cd ${relative(this.core.cwd, this.projectDirPath)}`
      )
    );
    console.log(chalk.hex('#777777')('$ npm run dev'));
    console.log('');
    console.log('');
    console.log(chalk.hex('#3eab34')('Thanks for using Midway'));
    console.log('');
    console.log(
      'Document ❤ Star:',
      chalk.hex('#1C95E2')('https://github.com/midwayjs/midway')
    );
    console.log('');
  }
}
