import { BasePlugin } from '@midwayjs/command-core';
import { join } from 'path';
import { existsSync, remove } from 'fs-extra';
export class CleanPlugin extends BasePlugin {
  commands = {
    clean: {
      usage: 'clean local log and cache',
      lifecycleEvents: ['clean'],
    },
  };

  hooks = {
    'clean:clean': this.clean.bind(this),
  };

  async clean() {
    const { cwd } = this.core;
    if (!existsSync(join(cwd, 'package.json'))) {
      console.log(`[ Midway ] package.json not found in ${cwd}\n`);
      return;
    }

    await this.rmDir();

    const pkg = require(join(cwd, 'package.json'));
    if (pkg['midway-bin-clean'] && pkg['midway-bin-clean'].length) {
      for (const file of pkg['midway-bin-clean']) {
        await this.safeRemove(join(cwd, file));
        console.log(`[ Midway ] clean ${file} success!`);
      }
      console.log('[ Midway ] clean complete!');
    }
  }

  private async rmDir() {
    const { cwd } = this.core;
    const rmDirName = ['logs', 'run', '.nodejs-cache'];
    for (const name of rmDirName) {
      await this.safeRemove(join(cwd, name));
    }
    console.log('[ Midway ] clean midway temporary files complete!');
  }

  private safeRemove(path) {
    if (!existsSync(path)) {
      return;
    }
    return remove(path);
  }
}
