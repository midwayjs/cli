const ts = require('typescript');
const chalk = require('chalk');
const { relative } = require('path');
const options = JSON.parse(process.argv[2]);
const errorOutput = (...args) => {
  console.error(chalk.hex('#ff0000')('[ Midway ]', ...args));
};

const check = () => {
  const cwd = options.cwd;
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
      error.messageText && error.messageText.messageText
        ? error.messageText.messageText
        : error.messageText;
    errorOutput(`TS Error: ${message || 'unknown error'}${errorPath}`);
  }
};

check();
