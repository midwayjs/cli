import { invoke } from '@midwayjs/serverless-invoke';
import { Lock } from '@midwayjs/command-core';
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

const deleteLock = new Lock('dev-pack-invoke-delete');

export async function invokeFunction(options) {
  options.incremental = options.incremental ?? true;
  await deleteLock.wait(async () => {
    const tmpDistDir = join(
      options?.functionDir || process.cwd(),
      '.faas_debug_tmp'
    );
    if (existsSync(tmpDistDir)) {
      await remove(tmpDistDir);
    }
  });
  return invoke(options);
}
