import {
  BasePlugin,
  ICommandInstance,
  ICoreInstance,
  IPluginCommands,
  IPluginHooks,
} from '@midwayjs/command-core';
import consola from 'consola';
import prettier from 'prettier';
import { inputPromptStringValue, names } from '../lib/helper';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { compile as EJSCompile } from 'ejs';

export interface ControllerOptions {
  dry: boolean;
  class: string;
  dotFile: boolean;
  override: boolean;
  file: string;
  dir: string;
  light: boolean;
}

export const mountControllerCommand = (): ICommandInstance => {
  // TODO: 从接口中直接生成选项

  return {
    controller: {
      usage: 'controller genrator',
      lifecycleEvents: ['gen'],
      opts: {
        dry: {
          usage: '',
        },
        class: {
          usage: '',
        },
        dotFile: { usage: '' },
        override: { usage: '' },
        file: { usage: '' },
        dir: { usage: '' },
        light: { usage: '' },
      },
    },
  };
};

export async function controllerHandler(
  { cwd: projectDirPath }: ICoreInstance,
  opts: ControllerOptions
) {
  try {
    consola.info(`Project location: ${chalk.green(projectDirPath)}`);

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
      projectDirPath,
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
          `../templates/controller/${
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

      consola.info(`File will be created: ${chalk.green(controllerFilePath)}`);
    }

    consola.success('Generator execution accomplished.');
  } catch (error) {
    consola.fatal('Generator execution failed. \n');
    throw error;
  }
}
