import inquirer from 'inquirer';
import { camelCase } from 'camel-case';
import { lowerCase } from 'lower-case';
import { constantCase } from 'constant-case';
import { dotCase } from 'dot-case';
import { capitalCase } from 'capital-case';

import findUp from 'find-up';
import path from 'path';
import fs from 'fs-extra';
import minIndent from 'min-indent';
import prettier from 'prettier';

import parseJson from 'parse-json';
import normalizePackageData from 'normalize-package-data';

export function formatTSFile(filePath: string) {
  const origin = fs.readFileSync(filePath, 'utf-8');
  const formatted = prettier.format(origin, { parser: 'typescript' });
  fs.writeFileSync(filePath, formatted);
}

export function readPackageSync({
  cwd = process.cwd(),
  normalize = true,
} = {}) {
  const filePath = path.resolve(cwd, 'package.json');
  const json = parseJson(fs.readFileSync(filePath, 'utf8'));

  if (normalize) {
    normalizePackageData(json);
  }

  return json;
}

export function stripIndent(string: string) {
  const indent = minIndent(string);

  if (indent === 0) {
    return string;
  }

  const regex = new RegExp(`^[ \\t]{${indent}}`, 'gm');

  return string.replace(regex, '');
}

export const inputPromptStringValue = async (
  identifier: string,
  defaultValue?: string | null
): Promise<string> => {
  const promptedValue = await inquirer.prompt([
    {
      type: 'input',
      name: identifier,
      default: defaultValue ?? null,
    },
  ]);

  return promptedValue[identifier];
};

type Names = Record<
  'className' | 'dotName' | 'fileName' | 'constantName',
  string
>;

// className -> capitalCase
// dotName -> dotCase
// fileName -> lowerCase
// constantName -> constantCase

// export const NAME_SKIP_FLAG = '__SKIP__';

// export function names(origin: string): Names;

// export function names(origin: string, flag: typeof NAME_SKIP_FLAG): undefined;

export function names(origin: string): Names | undefined {
  return {
    className: capitalCase(origin),
    dotName: dotCase(origin),
    fileName: lowerCase(origin),
    constantName: constantCase(origin),
  };
}

export const updateGitIgnore = (patterns: string[], cwd?: string) => {
  const pathUnderGitControl = findUp.sync(['.git'], {
    type: 'directory',
    cwd,
  });

  const ignoreFilePath = path.resolve(
    path.dirname(pathUnderGitControl),
    '.gitignore'
  );

  let originContent = fs.readFileSync(ignoreFilePath, 'utf8');

  patterns.forEach(pattern => {
    if (!originContent.includes(pattern)) {
      originContent = `${originContent}\n
${pattern}`;
    }
  });

  const content = stripIndent(originContent);

  fs.writeFileSync(ignoreFilePath, content);
};
