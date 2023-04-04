import { relative } from 'path';
import * as assert from 'assert';

import {
  DiagnosticMessageChain,
  DiagnosticRelatedInformation,
  // eslint-disable-next-line node/no-unpublished-import
} from 'typescript';

import { formatTsError } from '../src/utils/compileTypeScript';

const filename = relative(process.cwd(), __filename).replace(/\\/gu, '/');

describe(filename, () => {
  const baseDir = process.cwd();
  const name = 'index.test.ts';
  const fileText = `import assert from 'node:assert/strict';
import { relative } from 'node:path';
void assert;
void relative;`;
  const expectPath = `${name}:4:14`;

  it('messageText is string', async () => {
    const messageText = 'messageText is string';

    const info = {
      category: 1,
      code: 2345,
      file: {
        text: fileText,
        fileName: `./${name}`,
      },
      start: 1000,
      length: 1000,
      messageText,
    } as DiagnosticRelatedInformation;

    const ret = formatTsError(baseDir, info);
    assert(ret);
    assert(ret.message === messageText);
    assert(ret.path === expectPath);
  });

  it('messageText is empty', async () => {
    const messageText = '';

    const info = {
      category: 1,
      code: 2345,
      file: {
        text: fileText,
        fileName: `./${name}`,
      },
      start: 1000,
      length: 1000,
      messageText,
    } as DiagnosticRelatedInformation;

    const ret = formatTsError(baseDir, info);
    assert(ret);
    assert(ret.message === messageText);
    assert(ret.path === '');
  });

  it('messageText is DiagnosticMessageChain', async () => {
    const text1 = 'messageText is DiagnosticMessageChain';
    const messageText: DiagnosticMessageChain = {
      messageText: text1,
      category: 1,
      code: 2,
    };

    const info = {
      category: 1,
      code: 2345,
      file: {
        text: fileText,
        fileName: `./${name}`,
      },
      start: 1000,
      length: 1000,
      messageText,
    } as DiagnosticRelatedInformation;

    const ret = formatTsError(baseDir, info);
    assert(ret);
    assert(ret.message === text1);
    assert(ret.path === expectPath);
  });

  it('messageText is DiagnosticMessageChain and empty next', async () => {
    const text1 = 'messageText is DiagnosticMessageChain';
    const messageText: DiagnosticMessageChain = {
      messageText: text1,
      category: 1,
      code: 2,
      next: [],
    };

    const info = {
      category: 1,
      code: 2345,
      file: {
        text: fileText,
        fileName: `./${name}`,
      },
      start: 1000,
      length: 1000,
      messageText,
    } as DiagnosticRelatedInformation;

    const ret = formatTsError(baseDir, info);
    assert(ret);
    assert(ret.message === text1);
    assert(ret.path === expectPath);
  });

  it('messageText is DiagnosticMessageChain and next', async () => {
    const text1 = 'messageText is DiagnosticMessageChain';
    const chainMessageText = 'messageText is DiagnosticMessageChain next';

    const chain: DiagnosticMessageChain = {
      messageText: chainMessageText,
      category: 1,
      code: 2,
      next: [],
    };
    const messageText: DiagnosticMessageChain = {
      messageText: text1,
      category: 1,
      code: 2,
      next: [chain],
    };

    const info = {
      category: 1,
      code: 2345,
      file: {
        text: fileText,
        fileName: `./${name}`,
      },
      start: 1000,
      length: 1000,
      messageText,
    } as DiagnosticRelatedInformation;
    const ret = formatTsError(baseDir, info);

    assert(ret);
    assert(ret.message);
    assert(ret.path === expectPath);
    const messageArr = ret.message.split('\n');
    assert(Array.isArray(messageArr));
    const [message1, message2] = messageArr;
    assert(message1 === text1);
    assert(message2.trim() === chainMessageText);
  });
});
