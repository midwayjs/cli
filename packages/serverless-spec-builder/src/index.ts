import { parse, saveYaml } from './parse';
import { readFileSync, existsSync } from 'fs';
import { isAbsolute, join, resolve, dirname } from 'path';
import { SpecBuilder } from './builder';

export * from './interface';
export * from './builder';
export * from './wrapper';
export { filterUserDefinedEnv } from './utils';

const pattern = /\$\{\s*(\w+\.\w+)\s*\}/g;

export const transform = (sourcefilePathOrJson: any, builderCls?) => {
  let result: any = sourcefilePathOrJson;
  if (typeof sourcefilePathOrJson === 'string') {
    if (existsSync(sourcefilePathOrJson)) {
      const content = readFileSync(sourcefilePathOrJson, 'utf8');
      const yamlContent = content.replace(pattern, (match, key) => {
        if (key.startsWith('env.')) {
          return process.env[key.replace('env.', '')] || match;
        }
      });
      // replace
      result = parse(sourcefilePathOrJson, yamlContent);
    }
  }
  if (!result) {
    return;
  }
  if (builderCls) {
    return new builderCls(result).toJSON();
  } else {
    return new SpecBuilder(result).toJSON();
  }
};

export { saveYaml, parse } from './parse';

export const generate = (
  sourceFilePathOrJson: any,
  targetFilePath: string,
  builderCls?
) => {
  let baseDir = process.cwd();
  let transformResultJSON = {};
  if (typeof sourceFilePathOrJson === 'string') {
    if (!isAbsolute(sourceFilePathOrJson)) {
      sourceFilePathOrJson = join(baseDir, sourceFilePathOrJson);
    } else {
      baseDir = dirname(sourceFilePathOrJson);
    }
  }
  transformResultJSON = transform(sourceFilePathOrJson, builderCls);
  if (!isAbsolute(targetFilePath)) {
    targetFilePath = join(baseDir, targetFilePath);
  }
  return saveYaml(targetFilePath, transformResultJSON);
};

export const getSpecFile = baseDir => {
  baseDir = baseDir || process.cwd();
  const specPath = [
    'f.yml',
    'f.yaml',
    'serverless.yml',
    'serverless.yaml',
  ].find(spec => existsSync(resolve(baseDir, spec)));
  if (specPath) {
    return {
      type: 'yaml',
      path: resolve(baseDir, specPath),
    };
  }
  return {};
};

export const loadSpec = (baseDir, specFileInfo?) => {
  const specFile = specFileInfo || getSpecFile(baseDir);
  if (!specFile || !specFile.type) {
    return {};
  }
  if (specFile.type === 'yaml') {
    return transform(specFile.path);
  }
};

export const writeToSpec = (baseDir, specResult, specFileInfo?) => {
  const specFile = specFileInfo || getSpecFile(baseDir);
  if (!specFile || !specFile.type) {
    return {};
  }
  if (specFile.type === 'yaml') {
    return saveYaml(specFile.path, specResult);
  }
};
