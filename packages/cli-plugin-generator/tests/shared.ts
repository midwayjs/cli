import { CommandCore } from '@midwayjs/command-core';
import path from 'path';
import fs from 'fs-extra';
import consola from 'consola';
import jsonfile from 'jsonfile';
import execa from 'execa';
import { GeneratorPlugin } from '../src';
import { capitalCase } from 'capital-case';

export const expectGenerateValidFile = (
  generatedPath: string,
  classIdentifier: string
) => {
  expect(fs.existsSync(generatedPath)).toBeTruthy();

  expect(
    fs.readFileSync(generatedPath, { encoding: 'utf-8' }).length
  ).toBeGreaterThan(0);

  expect(
    fs
      .readFileSync(generatedPath, { encoding: 'utf-8' })
      .includes(capitalCase(classIdentifier))
  ).toBeTruthy();
};

export async function resetFixtures() {
  await execa('node ./tests/copy.js', {
    cwd: process.cwd(),
    shell: true,
    stdio: 'inherit',
  });
}

export const baseDir = path.resolve(__dirname, './fixtures/base');

export const configPath = path.join(
  baseDir,
  'src',
  './config/config.default.ts'
);

export const configurationPath = path.join(
  baseDir,
  'src',
  './configuration.ts'
);

export const packagePath = path.join(baseDir, './package.json');

export async function createGeneratorCommand() {
  const core = new CommandCore({
    config: {
      servicePath: baseDir,
    },
    commands: ['gen'],
    options: {},
    log: consola,
    cwd: baseDir,
  });
  core.addPlugin(GeneratorPlugin);

  await core.ready();

  return core;
}
