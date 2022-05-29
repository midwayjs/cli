import * as plimit from 'p-limit';
import * as globby from 'globby';
import { join } from 'path';
import { access, copy, stat } from 'fs-extra';
export const copyFiles = async (options: ICopyOptions) => {
  const { defaultInclude, include, exclude, sourceDir, targetDir, log } =
    options;
  const paths = await globby(
    (
      defaultInclude || ['*.yml', '*.js', '*.ts', '*.json', 'app', 'config']
    ).concat(include || []),
    {
      cwd: sourceDir,
      followSymbolicLinks: false,
      ignore: [
        '**/node_modules/**', // 模块依赖目录
        '**/test/**', // 测试目录
        '**/run/**', // egg 运行调试目录
        '**/.serverless/**', // faas 构建目录
        '**/.faas_debug_tmp/**', // faas 调试临时目录
      ].concat(exclude || []),
    }
  );
  await docopy(sourceDir, targetDir, paths, log);
};

export const copyStaticFiles = async ({ sourceDir, targetDir, log }) => {
  if (!sourceDir || !targetDir) {
    return;
  }
  const paths = globby.sync(['**/*.*'], {
    cwd: sourceDir,
    followSymbolicLinks: false,
    ignore: [
      '**/*.ts',
      '**/node_modules/**', // 模块依赖目录
    ],
  });
  return docopy(sourceDir, targetDir, paths, log);
};

const docopy = async (
  sourceDir: string,
  targetDir: string,
  paths: string[],
  log?
) => {
  const limit = plimit(20);
  await Promise.all(
    paths.map((path: string) => {
      return limit(async () => {
        const source = join(sourceDir, path);
        const target = join(targetDir, path);
        if (await exists(target)) {
          const sourceStat = await stat(source);
          const targetStat = await stat(target);
          // source 修改时间小于目标文件 修改时间，则不拷贝
          if (sourceStat.mtimeMs <= targetStat.mtimeMs) {
            return;
          }
        }
        if (log) {
          log(path);
        }

        return copy(source, target).catch(e => {
          if (log) {
            log(`Error!!! From '${source}' to '${target}'`, e);
          }
        });
      });
    })
  );
};

export interface ICopyOptions {
  sourceDir: string;
  targetDir: string;
  defaultInclude?: string[];
  include?: string[];
  exclude?: string[];
  log?: (path: string) => void;
}

export const exists = async (path: string) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};
