import { findNpmModule } from "../npm"

export const compileTypeScript = (baseDir: string, tsOptions) => {
  const tsMod = findNpmModule(baseDir, 'typescript');
  const ts = require(tsMod);
  if (!tsOptions.compilerOptions) {
    tsOptions.compilerOptions = {};
  }
  tsOptions.compilerOptions = Object.assign({
    target: 'es2018',
    module: 'commonjs',
    outDir: './dist',
    rootDir: 'src',
    experimentalDecorators: true,
  }, tsOptions.compilerOptions);
  if (!tsOptions.include?.length) {
    tsOptions.include = ['src'];
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
  return {
    fileNames,
    diagnostics: emitResult.diagnostics,
    options: parsedCommandLine.options
  };
}