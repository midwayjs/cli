import { BasePlugin } from '@midwayjs/command-core';
import consola from 'consola';
import prettier from 'prettier';
import { inputPromptStringValue, names } from './lib/helper';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { compile as EJSCompile } from 'ejs';

// import { join } from 'path';
// import { existsSync, remove } from 'fs-extra';

// midway-bin gen -> prompt

interface ControllerOption {
  dry: boolean;
  class: string;
  dotFile: boolean;
  override: boolean;
  file: string;
  dir: string;
  light: boolean;
}

export class GeneratorPlugin extends BasePlugin {
  commands = {
    gen: {
      usage: 'generator tmp',
      lifecycleEvents: ['gen'],
      commands: {
        orm: {
          usage: 'orm genrator',
          lifecycleEvents: ['gen'],
        },
        controller: {
          usage: 'orm genrator',
          lifecycleEvents: ['gen'],
          opts: {
            dry: {
              usage: '',
            },
          },
        },
      },
    },
  };

  hooks = {
    'gen:gen': this.handler.bind(this),
    'gen:orm:gen': this.ormHandler.bind(this),
    'gen:controller:gen': this.controllerHandler.bind(this),
  };

  async handler() {
    console.log('handler');
    const { cwd } = this.core;
    // console.log('coreOpts: ', coreOpts);
    console.log('cwd: ', cwd);
  }

  async controllerHandler() {
    try {
      const { cwd } = this.core;

      const opts: ControllerOption = this.options;

      if (opts.dry) {
        consola.success('Executing in `dry run` mode, nothing will happen.');
      }

      if (!opts.class) {
        consola.warn('Controller name cannot be empty!');
        opts.class = await inputPromptStringValue('controller name');
      }

      // apply default value

      opts.dotFile = opts.dotFile ?? true;
      opts.dry = opts.dry ?? false;
      opts.dir = opts.dir ?? 'controller';
      opts.override = opts.override ?? false;
      opts.light = opts.light ?? false;

      const controllerNames = names(opts.class);
      const fileNameNames = names(opts.file ?? opts.class);

      const fileName = opts.dotFile
        ? `${fileNameNames.fileName}.controller`
        : fileNameNames.fileName;

      const controllerFilePath = path.resolve(
        cwd,
        'src',
        opts.dir,
        `${fileName}.ts`
      );

      consola.info(
        `Controller will be created in ${chalk.green(controllerFilePath)}`
      );

      const exist = fs.existsSync(controllerFilePath);

      if (exist && !opts.override) {
        consola.error(
          'File exist, enable `--override` to override existing file.'
        );
        process.exit(0);
      } else if (exist) {
        consola.warn('Overriding exist file');
      }

      const renderedTemplate = EJSCompile(
        fs.readFileSync(
          path.join(
            __dirname,
            `./templates/controller/${
              opts.light ? 'controller.ts.ejs' : 'controller-full.ts.ejs'
            }`
          ),
          { encoding: 'utf8' }
        ),
        {}
      )({ name: controllerNames.className });

      const outputContent = prettier.format(renderedTemplate, {
        parser: 'typescript',
        singleQuote: true,
      });

      if (!opts.dry) {
        fs.ensureFileSync(controllerFilePath);
        fs.writeFileSync(controllerFilePath, outputContent);
      } else {
        consola.success('Controller generator invoked with:');
        consola.info(`name: ${chalk.cyan(opts.class)}`);
        consola.info(`light: ${chalk.cyan(opts.light)}`);
        consola.info(`dot name: ${chalk.cyan(opts.dotFile)}`);
        consola.info(`override: ${chalk.cyan(opts.override)}`);
        consola.info(`file name: ${chalk.cyan(fileNameNames.fileName)}`);
        consola.info(`dir: ${chalk.cyan(opts.dir)}`);

        consola.info(
          `File will be created: ${chalk.green(controllerFilePath)}`
        );
      }

      consola.success('Generator execution accomplished.');
    } catch (error) {
      consola.fatal('Generator execution failed. \n');
      throw error;
    }
  }

  async ormHandler() {
    console.log('orm handler');
    const { cwd } = this.core;
    // console.log('coreOpts: ', coreOpts);
    console.log('cwd: ', cwd);
  }
}
