import { BasePlugin } from '@midwayjs/command-core';
import { transform } from '@midwayjs/serverless-spec-builder';
import { resolve } from 'path';
export class FaaSPlugin extends BasePlugin {
  async asyncInit() {
    const { cwd } = this.core;
    const fymlFile = resolve(cwd, 'f.yml');
    const spec = transform(fymlFile);
    // 挂载service
    this.core.service = spec;
    // 挂载faas config
    this.core.config = {
      servicePath: cwd,
      specFile: fymlFile,
    };
    console.log('异步初始化');
  }
}
