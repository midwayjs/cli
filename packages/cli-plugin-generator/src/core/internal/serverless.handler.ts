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
  SLSType,
} from '../utils';
import omit from 'lodash/omit';

export interface ServerlessOptions
  extends Omit<GeneratorSharedOptions, 'dotFile'> {
  /**
   * @description Identifier for function class
   */
  class: string;
  /**
   * @description Serverless function type
   * @value faas
   */
  type: SLSType;
  /**
   * @description Use http trigger(faas only)
   * @value true
   */
  http: boolean;
  /**
   * @description Use event trigger(faas only)
   * @value false
   */
  event: boolean;
  /**
   * @description Use gateway trigger(faas only)
   * @value false
   */
  gateway: boolean;
  /**
   * @description Use timer trigger(faas only)
   * @value false
   */
  timer: boolean;
  /**
   * @description Use oss trigger(faas only)
   * @value false
   */
  oss: boolean;
}

export const mountServerlessCommand = (): ICommandInstance => {
  const writerSharedOptions = {
    class: {
      name: 'Identifier for function class',
    },
    type: {
      name: 'Serverless function type',
    },
    http: {
      name: 'Use http trigger(faas only)',
    },
    event: {
      name: 'Use event trigger(faas only)',
    },
    gateway: {
      name: 'Use gateway trigger(faas only)',
    },
    timer: {
      name: 'Use timer trigger(faas only)',
    },
    oss: {
      name: 'Use oss trigger(faas only)',
    },
  };

  return {
    sls: {
      usage: 'serverless genrator',
      lifecycleEvents: ['gen'],
      opts: {
        ...omit(sharedOption, 'dotFile'),
        ...writerSharedOptions,
      },
    },
  };
};

async function serverlessHandlerCore(
  { cwd: projectDirPath }: ICoreInstance,
  opts: ServerlessOptions
) {
  consola.info(`Project location: ${chalk.green(projectDirPath)}`);

  const { dry, dotFile, override } = applyDefaultValueToSharedOption(opts);
  const { type = 'faas' } = opts;

  const usePlainFaasMode = type === 'faas';

  if (dry) {
    consola.success('Executing in `dry run` mode, nothing will happen.');
  }

  if (!opts.class) {
    consola.warn('Serverless class name cannot be empty!');
    opts.class = await inputPromptStringValue(
      'serverless name',
      usePlainFaasMode ? 'function' : 'aggr'
    );
  }

  const dir = opts.dir ?? usePlainFaasMode ? 'functions' : 'controller';

  // FIXME: use map for batch handling?
  const http = opts.http
    ? ensureBooleanType(opts.http)
    : applyFalsyDefaultValue(opts.http);

  const event = opts.event
    ? ensureBooleanType(opts.event)
    : applyFalsyDefaultValue(opts.event);

  const gateway = opts.gateway
    ? ensureBooleanType(opts.gateway)
    : applyFalsyDefaultValue(opts.gateway);

  const timer = opts.timer
    ? ensureBooleanType(opts.timer)
    : applyFalsyDefaultValue(opts.timer);

  const oss = opts.oss
    ? ensureBooleanType(opts.oss)
    : applyFalsyDefaultValue(opts.oss);

  const nameNames = names(opts.class);
  const fileNameNames = names(opts.file ?? opts.class);

  const fileName = fileNameNames.fileName;

  const faasFilePath = path.resolve(
    projectDirPath,
    'src',
    dir,
    `${fileName}.ts`
  );

  consola.info(
    `Serverless function will be created in ${chalk.green(faasFilePath)}`
  );

  const exist = fs.existsSync(faasFilePath);

  if (exist && !override) {
    consola.error('File exist, enable `--override` to override existing file.');
    process.exit(0);
  } else if (exist) {
    consola.warn('Overriding exist file');
  }

  const renderedTemplate = EJSCompile(
    fs.readFileSync(
      path.join(
        __dirname,
        `../../templates/serverless/${
          usePlainFaasMode ? 'function.ts.ejs' : 'aggr.ts.ejs'
        }`
      ),
      { encoding: 'utf8' }
    ),
    {}
  )({
    [usePlainFaasMode ? '__Function_Name__' : '__Class_Name__']:
      nameNames.className,
    event,
    oss,
    gateway,
    timer,
    http,
  });

  const outputContent = prettier.format(renderedTemplate, {
    parser: 'typescript',
    singleQuote: true,
  });

  if (!dry) {
    fs.ensureFileSync(faasFilePath);
    fs.writeFileSync(faasFilePath, outputContent);
  } else {
    consola.success('Serverless generator invoked with:');
    consola.info(`Type: ${chalk.cyan(type)}`);
    consola.info(`Class Name: ${chalk.cyan(opts.class)}`);

    consola.info(`http: ${chalk.cyan(http)}`);
    consola.info(`event: ${chalk.cyan(event)}`);
    consola.info(`gateway: ${chalk.cyan(gateway)}`);
    consola.info(`timer: ${chalk.cyan(timer)}`);
    consola.info(`oss: ${chalk.cyan(oss)}`);

    consola.info(`Override: ${chalk.cyan(override)}`);
    consola.info(`Dot File: ${chalk.cyan(dotFile)}`);
    consola.info(`Dir: ${chalk.cyan(dir)}`);
    consola.info(`Generated File Name: ${chalk.cyan(fileNameNames.fileName)}`);

    consola.info(`File will be created: ${chalk.green(faasFilePath)}`);
  }
}

export default async function serverlessHandler(...args: unknown[]) {
  await generatorInvokeWrapper(serverlessHandlerCore, ...args);
}
