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
import jsonfile from 'jsonfile';
import pick from 'lodash/pick';

export const DEBUG_CONFIG_PATH = '.vscode/launch.json';

export interface DebugOptions extends Pick<GeneratorSharedOptions, 'dry'> {
  /**
   * @description Debug port
   * @value 7777
   */
  port: number;
  /**
   * @description Configuration name
   * @value 'Midway Local'
   */
  name: string;
}

export const mountDebugCommand = (): ICommandInstance => {
  const writerSharedOptions = {
    port: {
      usage: 'Debug port',
    },
    name: {
      usage: 'Configuration name',
    },
  };

  return {
    debug: {
      usage: 'Generator for debug configuration file(launch.json)',
      lifecycleEvents: ['gen'],
      opts: {
        ...pick(sharedOption, ['dry']),
        ...writerSharedOptions,
      },
    },
  };
};

async function debugHandlerCore(
  { cwd: projectDirPath }: ICoreInstance,
  opts: DebugOptions
) {
  consola.info(`Project location: ${chalk.green(projectDirPath)}`);

  const { dry } = applyDefaultValueToSharedOption(opts);

  const { port = 7777, name = 'Midway Local' } = opts;

  if (dry) {
    consola.success('Executing in `dry run` mode, nothing will happen.');
  }

  const debugFilePath = path.resolve(projectDirPath, DEBUG_CONFIG_PATH);

  consola.info(
    `Debug configuration will be created in ${chalk.green(debugFilePath)}`
  );

  const prevExist = fs.existsSync(debugFilePath);

  let prevContent: any = {};

  try {
    prevContent = jsonfile.readFileSync(debugFilePath);
  } catch (error) {
    prevContent = {};
  }

  const writeContent: any = {};

  const createDebuggerConfiguration = (updatedName?: string) => ({
    name: updatedName ?? name,
    type: 'node',
    request: 'launch',
    cwd: '${workspaceRoot}',
    runtimeExecutable: 'npm',
    windows: {
      runtimeExecutable: 'npm.cmd',
    },
    runtimeArgs: ['run', 'dev'],
    env: {
      NODE_ENV: 'local',
    },
    console: 'integratedTerminal',
    protocol: 'auto',
    restart: true,
    port,
    autoAttachChildProcesses: true,
  });

  if (
    !prevExist ||
    !Object.keys(prevContent).length ||
    !prevContent.configuration.length
  ) {
    writeContent.version = '0.2.0';
    writeContent.configuration = [createDebuggerConfiguration()];
  } else if (prevContent.configuration.length) {
    const sameNameList = (prevContent.configuration as any[]).filter(
      config => config.name === name
    );

    // Configuration with same name exists
    if (sameNameList.length) {
      writeContent.configuration = prevContent.configuration;
      writeContent.configuration.push(
        createDebuggerConfiguration(`${name} ${Date.now()}`)
      );
    }
  }

  if (!dry) {
    fs.ensureFileSync(debugFilePath);
    fs.writeFileSync(
      debugFilePath,
      prettier.format(JSON.stringify(writeContent), { parser: 'json' })
    );
  } else {
    consola.success('Debug generator invoked with:');
    consola.info(`File will be created: ${chalk.green(debugFilePath)}`);
  }
}

export default async function debugHandler(...args: unknown[]) {
  await generatorInvokeWrapper(debugHandlerCore, ...args);
}
