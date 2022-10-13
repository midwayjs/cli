import { isAbsolute, relative } from 'path';
export const transformToRelative = (baseDir: string, targetDir: string) => {
  if (targetDir) {
    if (isAbsolute(targetDir)) {
      return relative(baseDir, targetDir);
    }
    return targetDir;
  }
};

export const getMainVersion = version => {
  version = (version || '').split('.')[0];
  if (version === 'latest' || version === 'beta') {
    return '3';
  }
  return version.replace(/[^\d]/g, '') || '3';
};
