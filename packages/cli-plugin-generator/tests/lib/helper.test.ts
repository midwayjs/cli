import {
  formatTSFile,
  readPackageSync,
  stripIndent,
  inputPromptStringValue,
  names,
  updateGitIgnore,
} from '../../src/lib/helper';
import path from 'path';
import { baseDir, configPath, resetFixtures } from '../shared';
import prettier from 'prettier';
import fs from 'fs-extra';

describe('helper', () => {
  beforeAll(async () => {
    jest.setTimeout(300000);
    await resetFixtures();
  });

  beforeEach(async () => {
    await resetFixtures();
  });

  it('should call format file', () => {
    const spiedFormat = jest
      .spyOn(prettier, 'format')
      .mockReturnValue('let x;');
    const spiedReadFileSync = jest
      .spyOn(fs, 'readFileSync')
      .mockReturnValue('const x: number = 1;');
    const spiedWriteFileSync = jest.spyOn(fs, 'writeFileSync');

    formatTSFile(configPath);

    expect(spiedReadFileSync).toBeCalled();
    expect(spiedReadFileSync).toBeCalledTimes(1);
    expect(spiedReadFileSync).toBeCalledWith(configPath, 'utf-8');

    expect(spiedFormat).toBeCalled();
    expect(spiedFormat).toBeCalledTimes(1);
    expect(spiedFormat).toBeCalledWith('const x: number = 1;', {
      parser: 'typescript',
    });

    expect(spiedWriteFileSync).toBeCalled();
    expect(spiedWriteFileSync).toBeCalledTimes(1);
    expect(spiedWriteFileSync).toBeCalledWith(configPath, 'let x;');
  });

  it('should create names', () => {
    expect(names('foo')).toEqual({
      className: 'Foo',
      dotName: 'foo',
      fileName: 'foo',
      constantName: 'FOO',
    });
    expect(names('foo')).toEqual({
      className: 'Foo',
      dotName: 'foo',
      fileName: 'foo',
      constantName: 'FOO',
    });
    expect(names('f-oo')).toEqual({
      className: 'F Oo',
      dotName: 'f.oo',
      fileName: 'f-oo',
      constantName: 'F_OO',
    });
    expect(names('f-OO')).toEqual({
      className: 'F Oo',
      dotName: 'f.oo',
      fileName: 'f-oo',
      constantName: 'F_OO',
    });
    expect(names('fOO')).toEqual({
      className: 'F Oo',
      dotName: 'f.oo',
      fileName: 'foo',
      constantName: 'F_OO',
    });
  });
});
