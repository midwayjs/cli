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
  Framework,
  FrameworkGroup,
} from '../utils';
import omit from 'lodash/omit';

export interface MiddlewareOptions
  extends Omit<GeneratorSharedOptions, 'dotFile'> {
  /**
   * @description Identifier for middleware
   */
  class: string;
  /**
   * @description Use external lib for middleware resolver
   * @value false
   */
  external: boolean;
  /**
   * @description Target framework
   * @value 'egg'
   */
  framework: Framework;
  /**
   * @description Use functional middleware(EggJS only)
   * @value false
   */
  functional: boolean;
}

export const mountMiddlewareCommand = (): ICommandInstance => {
  const writerSharedOptions = {
    class: {
      name: 'Middleware identifier',
    },
    external: {
      name: 'Use external lib for middleware resolver',
    },
    framework: {
      name: 'Target framework',
    },
    functional: {
      name: 'Use functional middleware(EggJS only)',
    },
  };

  return {
    middleware: {
      usage: 'middleware genrator',
      lifecycleEvents: ['gen'],
      opts: {
        ...omit(sharedOption, 'dotFile'),
        ...writerSharedOptions,
      },
    },
  };
};

export type FrameworkSpecificInfo = {
  templatePath: string;
};

export const frameworkSpecificInfo = (
  framework: Framework
): FrameworkSpecificInfo => {
  switch (framework) {
    case 'koa':
      return {
        templatePath: '../../templates/middleware/koa-middleware.ts.ejs',
      };
    case 'express':
      return {
        templatePath: '../../templates/middleware/express-middleware.ts.ejs',
      };
    case 'egg':
    default:
      return {
        templatePath: '../../templates/middleware/egg-middleware.ts.ejs',
      };
  }
};

async function middlewareHandlerCore(
  { cwd: projectDirPath }: ICoreInstance,
  opts: MiddlewareOptions
) {
  consola.info(`Project location: ${chalk.green(projectDirPath)}`);

  const { dry, dotFile, override } = applyDefaultValueToSharedOption(opts);
  const { dir = 'middleware', framework = 'egg' } = opts;

  if (dry) {
    consola.success('Executing in `dry run` mode, nothing will happen.');
  }

  if (!FrameworkGroup.includes(framework)) {
    consola.error(
      `Unsupported framework: ${framework}, use oneof ${chalk.cyan(
        FrameworkGroup.join(' ')
      )}`
    );
    process.exit(0);
  }

  if (!opts.class) {
    consola.warn('Middleware name cannot be empty!');
    opts.class = await inputPromptStringValue('middleware name', 'sample');
  }

  const external = opts.external
    ? ensureBooleanType(opts.external)
    : applyFalsyDefaultValue(opts.external);

  const functional = opts.functional
    ? ensureBooleanType(opts.functional)
    : applyFalsyDefaultValue(opts.functional);

  const middlewareNames = names(opts.class);
  const fileNameNames = names(opts.file ?? opts.class);

  const fileName = fileNameNames.fileName;

  const middlewareFilePath = path.resolve(
    projectDirPath,
    'src',
    dir,
    `${fileName}.ts`
  );

  consola.info(
    `Middleware will be created in ${chalk.green(middlewareFilePath)}`
  );

  const exist = fs.existsSync(middlewareFilePath);

  if (exist && !override) {
    consola.error('File exist, enable `--override` to override existing file.');
    process.exit(0);
  } else if (exist) {
    consola.warn('Overriding exist file');
  }

  const renderedTemplate = EJSCompile(
    fs.readFileSync(
      path.join(__dirname, frameworkSpecificInfo(framework).templatePath),
      { encoding: 'utf8' }
    ),
    {}
  )({
    name: middlewareNames.className,
    useExternalLib: external,
    functional,
  });

  const outputContent = prettier.format(renderedTemplate, {
    parser: 'typescript',
    singleQuote: true,
  });

  if (!dry) {
    fs.ensureFileSync(middlewareFilePath);
    fs.writeFileSync(middlewareFilePath, outputContent);
  } else {
    consola.success('Middleware generator invoked with:');
    consola.info(`Class Name: ${chalk.cyan(opts.class)}`);

    consola.info(`External: ${chalk.cyan(external)}`);
    consola.info(`Framework: ${chalk.cyan(framework)}`);
    consola.info(`Functional: ${chalk.cyan(functional)}`);

    consola.info(`Override: ${chalk.cyan(override)}`);
    consola.info(`Dot File: ${chalk.cyan(dotFile)}`);
    consola.info(`Dir: ${chalk.cyan(dir)}`);
    consola.info(`Generated File Name: ${chalk.cyan(fileNameNames.fileName)}`);

    consola.info(`File will be created: ${chalk.green(middlewareFilePath)}`);
  }
}

export default async function middlewareHandler(...args: unknown[]) {
  await generatorInvokeWrapper(middlewareHandlerCore, ...args);
}
