import { invoke } from '@midwayjs/serverless-invoke';
import { existsSync, remove } from 'fs-extra';
import { join } from 'path';
export function resolveModule(gatewayName: string) {
  const gatewayJSON = require('../gateway.json');
  if (gatewayJSON[gatewayName]) {
    return require(gatewayJSON[gatewayName]);
  } else {
    throw new Error(`unsupport gateway type ${gatewayName}`);
  }
}

export async function invokeFunction(options) {
  options.incremental = options.incremental ?? true;
  // 首次的时候执行清理
  if (!process.env.MIDWAT_FIRST_START_TMP_VAR) {
    const distDir = join(
      options?.functionDir || process.cwd(),
      '.faas_debug_tmp'
    );
    if (existsSync(distDir)) {
      try {
        await remove(distDir);
      } catch {
        //
      }
    }
    process.env.MIDWAT_FIRST_START_TMP_VAR = 'true';
  }
  return invoke(options);
}
