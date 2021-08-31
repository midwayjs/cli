import { isAbsolute, relative } from 'path';
export const transformToRelative = (baseDir: string, targetDir: string) => {
  if (targetDir) {
    if (isAbsolute(targetDir)) {
      return relative(baseDir, targetDir);
    }
    return targetDir;
  }
};
