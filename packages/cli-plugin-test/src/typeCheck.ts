import * as ts from 'typescript';
import { relative } from 'path';

export const typeCheck = cwd => {
  const tsconfigPath = ts.findConfigFile(cwd, ts.sys.fileExists);
  const { config } = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  const parsedCommandLine = ts.parseJsonConfigFileContent(config, ts.sys, cwd);
  const compilerOptions = {
    ...parsedCommandLine.options,
  };
  const host = ts.createCompilerHost(compilerOptions, true);
  const program = ts.createProgram(
    parsedCommandLine.fileNames,
    compilerOptions,
    host
  );
  const allDiagnostics = ts.getPreEmitDiagnostics(program);
  const errors = allDiagnostics.filter(diagnostic => {
    return diagnostic.category === ts.DiagnosticCategory.Error;
  });
  if (!Array.isArray(errors) || !errors.length) {
    return;
  }
  for (const error of errors) {
    const errorPath =
      error.file && error.file.fileName
        ? `(${relative(cwd, error.file.fileName)})`
        : '';
    const message =
      (error.messageText as any)?.messageText || error.messageText;
    throw new Error(`TS Error: ${message || 'unknown error'}${errorPath}`);
  }
};
