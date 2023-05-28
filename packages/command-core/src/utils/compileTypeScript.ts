import { readFile } from 'fs-extra';
import { join, relative } from 'path';
import {
  DiagnosticMessageChain,
  DiagnosticRelatedInformation,
  // eslint-disable-next-line node/no-unpublished-import
} from 'typescript';

import { findNpmModule } from '../npm';
import { exists } from './copy';

export const compileTypeScript = async (options: {
  baseDir: string;
  sourceDir?: string;
  outDir?: string;
  tsOptions?: any;
  coverOptions?: any;
}) => {
  let { tsOptions } = options;
  const { baseDir, coverOptions, sourceDir, outDir } = options;
  const tsMod = findNpmModule(baseDir, 'typescript');
  const ts = require(tsMod);
  if (!tsOptions) {
    tsOptions = await getTsConfig(baseDir);
  }
  if (!tsOptions.compilerOptions) {
    tsOptions.compilerOptions = {};
  }
  tsOptions.compilerOptions = Object.assign(
    {
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
    },
    tsOptions.compilerOptions,
    coverOptions
  );

  if (outDir) {
    tsOptions.compilerOptions.outDir = outDir;
  }
  if (sourceDir) {
    tsOptions.compilerOptions.rootDir = sourceDir;
  }
  if (!tsOptions.include?.length) {
    tsOptions.include = [sourceDir || 'src'];
  }

  const parsedCommandLine = ts.parseJsonConfigFileContent(
    tsOptions,
    ts.sys,
    baseDir
  );
  const host = ts.createCompilerHost(parsedCommandLine.options);
  const fileNames = parsedCommandLine.fileNames;
  const program = ts.createProgram(fileNames, parsedCommandLine.options, host);
  const emitResult = program.emit();
  const allDiagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics) as DiagnosticRelatedInformation[];
  const errors = [];
  const necessaryErrors = [];
  for (const error of allDiagnostics) {
    if (error.category !== ts.DiagnosticCategory.Error) {
      continue;
    }
    const errorItem = formatTsError(baseDir, error);

    // @ts-expect-error reportsUnnecessary is not in type
    if (!error.reportsUnnecessary) {
      necessaryErrors.push(errorItem);
    }
    errors.push(errorItem);
  }
  return {
    fileNames,
    options: parsedCommandLine.options,
    errors,
    necessaryErrors,
  };
};

export const formatTsError = (
  baseDir: string,
  error: DiagnosticRelatedInformation
): { message: string; path: string } => {
  if (!error.messageText) {
    return { message: '', path: '' };
  }
  const message = pickMessageTextFromDiagnosticMessageChain(error.messageText);
  let errorPath = '';
  // tsconfig error, file is undefined
  if (error?.file?.text) {
    const code = error.file.text.slice(0, error.start).split('\n');
    errorPath = `${relative(baseDir, error.file.fileName)}:${code.length}:${
      code[code.length - 1].length
    }`;
  }
  return {
    message,
    path: errorPath,
  };
};

function pickMessageTextFromDiagnosticMessageChain(
  input: string | DiagnosticMessageChain
): string {
  if (typeof input === 'string') {
    return input;
  }

  const arr: string[] = [];

  if (input.messageText) {
    arr.push(input.messageText);
  } // void else
  if (Array.isArray(input.next)) {
    arr.push(...input.next.map(pickMessageTextFromDiagnosticMessageChain));
  } // void else

  return arr.join('\n  ');
}

export const readJson = async (path: string) => {
  if (await exists(path)) {
    try {
      return JSON.parse(await readFile(path, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
};

export const getTsConfig = async (baseDir: string) => {
  const tsConfigPath = join(baseDir, 'tsconfig.json');
  return readJson(tsConfigPath);
};
