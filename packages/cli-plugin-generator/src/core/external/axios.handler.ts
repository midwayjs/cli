import { ICommandInstance, ICoreInstance } from '@midwayjs/command-core';
import path from 'path';
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

const AXIOS_PKG = '@midwayjs/axios';

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

export async function axiosHandlerCore(
  { cwd: projectDirPath }: ICoreInstance,
  opts: AxiosOptions
) {
  consola.info(`Project location: ${chalk.green(projectDirPath)}`);

  const { dry } = applyDefaultValueToSharedOption(opts);
  const { namespace = 'orm' } = opts;

  if (dry) {
    consola.success('Executing in `dry run` mode, nothing will happen.');
  }

  dry
    ? consola.info('`[DryRun]` Skip dependencies installation check.')
    : await ensureDepsInstalled(AXIOS_PKG, projectDirPath);

  const project = new Project();

  const configurationPath = path.resolve(
    projectDirPath,
    './src/configuration.ts'
  );

  if (!dry) {
    consola.info('Source code will be transformed.');

    const configurationSource = project.addSourceFileAtPath(configurationPath);

    addImportDeclaration(
      configurationSource,
      namespace,
      '@midwayjs/orm',
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

export async function axiosHandler(...args: unknown[]) {
  await generatorInvokeWrapper(axiosHandlerCore, ...args);
}
