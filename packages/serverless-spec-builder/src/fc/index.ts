import { transform, generate } from '../index';
import { FCComponentSpecBuilder, FCSpecBuilder } from './builder';

export const generateFunctionsSpec = filePathOrSpecJson => {
  return transform(filePathOrSpecJson, FCSpecBuilder);
};

export const generateFunctionsSpecFile = (
  filePathOrSpecJson,
  targetFilePath = 'template.yml'
) => {
  generate(filePathOrSpecJson, targetFilePath, FCSpecBuilder);
};

export const generateComponentSpec = filePathOrSpecJson => {
  return transform(filePathOrSpecJson, FCComponentSpecBuilder);
};
