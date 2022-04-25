import { createWriteStream, lstat, readFile, readlink } from 'fs-extra';
import globby = require('globby');
import JSZip = require('jszip');
import { platform } from 'os';
import { dirname, join, relative } from 'path';
import { MakeZipOptions } from './interface';
import { uselessFilesMatch } from './utils';

export const makeZip = async (
  sourceDirection: string,
  targetFileName: string,
  options: MakeZipOptions = {}
) => {
  let ignore = [];
  if (options?.removeUselessFiles) {
    ignore = uselessFilesMatch;
  }
  const globbyMatched = ['**'];
  const npmClient = options.npm || '';
  if (npmClient?.startsWith('pnpm')) {
    globbyMatched.push('**/.pnpm/**');
  }
  const fileList = await globby(globbyMatched, {
    onlyFiles: false,
    followSymbolicLinks: false,
    cwd: sourceDirection,
    ignore,
  });
  const zip = new JSZip();
  const isWindows = platform() === 'win32';
  for (const fileName of fileList) {
    const absPath = join(sourceDirection, fileName);
    const stats = await lstat(absPath);
    if (stats.isDirectory()) {
      zip.folder(fileName);
    } else if (stats.isSymbolicLink()) {
      let link = await readlink(absPath);
      if (isWindows) {
        link = relative(dirname(absPath), link).replace(/\\/g, '/');
      }
      zip.file(fileName, link, {
        binary: false,
        createFolders: true,
        unixPermissions: stats.mode,
      });
    } else if (stats.isFile()) {
      const fileData = await readFile(absPath);
      zip.file(fileName, fileData, {
        binary: true,
        createFolders: true,
        unixPermissions: stats.mode,
      });
    }
  }
  await new Promise((res, rej) => {
    zip
      .generateNodeStream({
        platform: 'UNIX',
        compression: 'DEFLATE',
        compressionOptions: {
          level: 6,
        },
      })
      .pipe(createWriteStream(targetFileName))
      .once('finish', res)
      .once('error', rej);
  });
};
