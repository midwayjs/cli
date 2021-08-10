import { ICommandInstance, ICoreInstance } from '@midwayjs/command-core';
import consola from 'consola';
import prettier from 'prettier';
import { inputPromptStringValue, names } from '../../lib/helper';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { compile as EJSCompile } from 'ejs';
import { generatorInvokeWrapper } from '../../lib/wrapper';
import {
  GeneratorSharedOptions,
  sharedOption,
  applyTruthyDefaultValue,
  applyFalsyDefaultValue,
  ensureBooleanType,
  applyDefaultValueToSharedOption,
} from '../utils';

export interface ServiceOptions extends GeneratorSharedOptions {
  /**
   * @description Class identifier
   */
  class: string;
}

export const mountServiceCommand = (): ICommandInstance => {
  const writerSharedOptions = {
    class: {
      usage: 'Class identifier',
    },
  };

  return {
    service: {
      usage: 'service genrator',
      lifecycleEvents: ['gen'],
      opts: {
        ...sharedOption,
        ...writerSharedOptions,
      },
    },
  };
};

async function serviceHandlerCore(
  { cwd: projectDirPath }: ICoreInstance,
  opts: ServiceOptions
) {
  consola.info(`Project location: ${chalk.green(projectDirPath)}`);

  const { dry, dotFile, override } = applyDefaultValueToSharedOption(opts);

  if (dry) {
    consola.success('Executing in `dry run` mode, nothing will happen.');
  }

  if (!opts.class) {
    consola.warn('Service name cannot be empty!');
    opts.class = await inputPromptStringValue('service name', 'sample');
  }

  const dir = opts.dir ?? 'service';

  const serviceNames = names(opts.class);
  const fileNameNames = names(opts.file ?? opts.class);

  const fileName = dotFile
    ? `${fileNameNames.fileName}.service`
    : fileNameNames.fileName;

  const serviceFilePath = path.resolve(
    projectDirPath,
    'src',
    dir,
    `${fileName}.ts`
  );

  consola.info(`Service will be created in ${chalk.green(serviceFilePath)}`);

  const exist = fs.existsSync(serviceFilePath);

  if (exist && !override) {
    consola.error('File exist, enable `--override` to override existing file.');
    process.exit(0);
  } else if (exist) {
    consola.warn('Overriding exist file');
  }

  const renderedTemplate = EJSCompile(
    fs.readFileSync(
      path.join(__dirname, '../../templates/service/service.ts.ejs'),
      { encoding: 'utf8' }
    ),
    {}
  )({ name: serviceNames.className });

  const outputContent = prettier.format(renderedTemplate, {
    parser: 'typescript',
    singleQuote: true,
  });

  if (!dry) {
    fs.ensureFileSync(serviceFilePath);
    fs.writeFileSync(serviceFilePath, outputContent);
  } else {
    consola.success('Service generator invoked with:');
    consola.info(`Class Name: ${chalk.cyan(opts.class)}`);

    consola.info(`Override: ${chalk.cyan(override)}`);
    consola.info(`Dot File: ${chalk.cyan(dotFile)}`);
    consola.info(`Dir: ${chalk.cyan(dir)}`);
    consola.info(`Generated File Name: ${chalk.cyan(fileNameNames.fileName)}`);

    consola.info(`File will be created: ${chalk.green(serviceFilePath)}`);
  }
}

export default async function serviceHandler(...args: unknown[]) {
  await generatorInvokeWrapper(serviceHandlerCore, ...args);
}
