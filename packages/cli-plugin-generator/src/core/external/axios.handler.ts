import { ICommandInstance, ICoreInstance } from '@midwayjs/command-core';
import path from 'path';
import fs from 'fs-extra';
import consola from 'consola';
import chalk from 'chalk';
import { Project } from 'ts-morph';
import { formatTSFile } from '../../lib/helper';
import { ensureDepsInstalled } from '../../lib/package';
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

export interface AxiosOptions extends Pick<GeneratorSharedOptions, 'dry'> {
  /**
   * @description Import namespace for @midwayjs/axios import
   * @value axios
   */
  namespace: string;
}

export const AXIOS_DEP = ['@midwayjs/axios'];

export const mountAxiosCommand = (): ICommandInstance => {
  // TODO: 从接口中直接生成选项

  const writerSharedOptions = {
    namespace: {
      usage: 'Import namespace for @midwayjs/axios import ',
    },
  };

  return {
    axios: {
      usage: 'axios genrator',
      lifecycleEvents: ['gen'],
      opts: {
        ...pick(sharedOption, ['dry']),
        ...writerSharedOptions,
      },
    },
  };
};

async function axiosHandlerCore(
  { cwd: projectDirPath }: ICoreInstance,
  opts: AxiosOptions
) {
  consola.info(`Project location: ${chalk.green(projectDirPath)}`);

  const { dry } = applyDefaultValueToSharedOption(opts);
  const { namespace = 'axios' } = opts;

  if (dry) {
    consola.success('Executing in `dry run` mode, nothing will happen.');
  }

  dry
    ? consola.info('`[DryRun]` Skip dependencies installation check.')
    : await ensureDepsInstalled(AXIOS_DEP, projectDirPath);

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
        )}`
      );
      process.exit(0);
    }

    const configurationSource = project.addSourceFileAtPath(configurationPath);

    addImportDeclaration(
      configurationSource,
      namespace,
      '@midwayjs/axios',
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

export default async function axiosHandler(...args: unknown[]) {
  await generatorInvokeWrapper(axiosHandlerCore, ...args);
}
