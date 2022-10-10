import { readFile } from 'fs-extra';
import { join, relative } from 'path';
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
    .concat(emitResult.diagnostics);
  const errors = [];
  const necessaryErrors = [];
  for (const error of allDiagnostics) {
    if (error.category !== ts.DiagnosticCategory.Error) {
      continue;
    }
    const errorItem = formatTsError(baseDir, error);

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

const formatTsError = (baseDir, error) => {
  if (!error || !error.messageText) {
    return { message: '', path: '' };
  }
  if (typeof error.messageText === 'object') {
    return formatTsError(baseDir, error.messageText);
  }

  let errorPath = '';
  // tsconfig error, file is undefined
  if (error?.file?.text) {
    const code = error.file.text.slice(0, error.start).split('\n');
    errorPath = `${relative(baseDir, error.file.fileName)}:${code.length}:${
      code[code.length - 1].length
    }`;
  }
  return {
    message: error?.messageText || '',
    path: errorPath,
  };
};

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
