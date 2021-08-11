import { ICommandInstance, ICoreInstance } from '@midwayjs/command-core';
import path from 'path';
import fs from 'fs-extra';
import consola from 'consola';
import chalk from 'chalk';
import { Project } from 'ts-morph';
import { formatTSFile } from '../../lib/helper';
import { ensureDepsInstalled, ensureDevDepsInstalled } from '../../lib/package';
import {
  updateDecoratorArrayArgs,
  addImportDeclaration,
  ImportType,
} from '../../lib/ast';
import { generatorInvokeWrapper } from '../../lib/wrapper';
import {
  GeneratorSharedOptions,
  sharedOption,
  applyDefaultValueToSharedOption,
} from '../utils';
import pick from 'lodash/pick';

export interface SwaggerOptions extends Pick<GeneratorSharedOptions, 'dry'> {
  /**
   * @description Output Swagger UI in server side.
   * @value false
   */
  ui: boolean;
  /**
   * @description Import namespace for @midwayjs/swagger import
   * @value axios
   */
  namespace: string;
}

export const SWAGGER_DEP = ['@midwayjs/swagger'];
export const SWAGGER_DEV_DEP = ['swagger-ui-dist'];

export const mountSwaggerCommand = (): ICommandInstance => {
  const writerSharedOptions = {
    ui: {
      usage: 'Output Swagger UI in server side',
    },
    namespace: {
      usage: 'Import namespace for @midwayjs/swagger import',
    },
  };

  return {
    swagger: {
      usage: 'Generator for @midwayjs/swagger setup',
      lifecycleEvents: ['gen'],
      opts: {
        ...pick(sharedOption, ['dry']),
        ...writerSharedOptions,
      },
    },
  };
};

async function swaggerHandlerCore(
  { cwd: projectDirPath }: ICoreInstance,
  opts: SwaggerOptions
) {
  consola.info(`Project location: ${chalk.green(projectDirPath)}`);

  const { dry } = applyDefaultValueToSharedOption(opts);
  const { ui = false, namespace = 'swagger' } = opts;

  if (dry) {
    consola.success('Executing in `dry run` mode, nothing will happen.');
  }

  if (ui) {
    consola.info(
      '`swagger-ui-dist` will be installed as `dependencies` by enabled `--ui` option.'
    );
    SWAGGER_DEP.push(...SWAGGER_DEV_DEP);
    SWAGGER_DEV_DEP.pop();
  }

  dry
    ? consola.info('`[DryRun]` Skip `dependencies` installation check.')
    : await ensureDepsInstalled(SWAGGER_DEP, projectDirPath);

  dry
    ? consola.info('`[DryRun]` Skip `devDependencies` installation check.')
    : await ensureDevDepsInstalled(SWAGGER_DEV_DEP, projectDirPath);

  if (!dry) {
    consola.info('Source code will be transformed.');

    const project = new Project();

    const configurationPath = path.resolve(
      projectDirPath,
      './src/configuration.ts'
    );

    if (!fs.existsSync(configurationPath)) {
      consola.error(
        `Cannot find ${chalk.cyan('configuration.ts')} in ${chalk.green(
          configurationPath
        )}.`
      );
      process.exit(0);
    }

    const configurationSource = project.addSourceFileAtPath(configurationPath);

    addImportDeclaration(
      configurationSource,
      namespace,
      '@midwayjs/swagger',
      ImportType.NAMESPACE_IMPORT
    );

    updateDecoratorArrayArgs(
      configurationSource,
      'Configuration',
      'imports',
      namespace
    );

    formatTSFile(configurationPath);
  } else {
    consola.info('`[DryRun]` Source code will be transformed.');
  }
}

export default async function swaggerHandler(...args: unknown[]) {
  await generatorInvokeWrapper(swaggerHandlerCore, ...args);
}
