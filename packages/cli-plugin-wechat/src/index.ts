import { BasePlugin, ICoreInstance } from '@midwayjs/command-core';
import { join } from 'path';
import { writeWrapper } from '@midwayjs/serverless-spec-builder';
import {
  writeFileSync,
  ensureDir,
  remove,
  existsSync,
  copy,
  readFileSync,
} from 'fs-extra';

export class WeChatPlugin extends BasePlugin {
  core: ICoreInstance;
  options: any;
  provider = 'wechat';
  servicePath = this.core.config.servicePath;
  midwayBuildPath = join(this.servicePath, '.serverless');
  wechatFunctionBuildPath = join(this.servicePath, 'cloudfunctions');

  hooks = {
    'before:package:cleanup': async () => {
      // 跳过zip打包
      this.options.skipZip = true;
      this.options.skipInstallDep = true;
      if (!this.core.service.package) {
        this.core.service.package = {};
      }
      this.core.service.package.include = (
        this.core.service?.package?.include || []
      ).concat(['config.json', 'sitemap.json']);
    },
    'package:generateEntry': async () => {
      this.core.cli.log('Generate entry file...');
      this.setGlobalDependencies('@midwayjs/serverless-scf-starter');
      writeWrapper({
        baseDir: this.servicePath,
        service: this.core.service,
        distDir: this.midwayBuildPath,
        starter: '@midwayjs/serverless-scf-starter',
      });
    },
    'package:package': async () => {
      // 拷贝到 cloudfunctions 目录
      console.log('this.core.service', this.core.service.functions);
      let projectPkgJson: any = {};
      try {
        const json: string = readFileSync(
          join(this.servicePath, 'package.json')
        ).toString();
        projectPkgJson = JSON.parse(json);
      } catch {
        // ignore
      }
      const functions = this.core.service.functions || {};
      if (existsSync(this.wechatFunctionBuildPath)) {
        this.core.cli.log('Clear old cloud functions directory');
        await remove(this.wechatFunctionBuildPath);
      }
      await ensureDir(this.wechatFunctionBuildPath);
      for (const func in functions) {
        const handlerConf = functions[func];
        if (handlerConf._ignore) {
          continue;
        }
        const [originFileName, handlerName] = handlerConf.handler.split('.');
        const cloudFunctionName = func;
        this.core.cli.log('Create function: ' + cloudFunctionName);

        const functionDir = join(
          this.wechatFunctionBuildPath,
          cloudFunctionName
        );
        await copy(this.midwayBuildPath, functionDir);

        await this.saveRemove(join(functionDir, 'src'));
        await this.saveRemove(join(functionDir, 'f.yml'));
        await this.saveRemove(join(functionDir, 'f.origin.yml'));
        await this.saveRemove(join(functionDir, 'tsconfig.json'));
        await this.saveRemove(join(functionDir, 'dist/midway.build.json'));
        await this.saveRemove(join(functionDir, 'dist/.mwcc-cache'));

        if (originFileName !== 'index') {
          const main = 'index.js';
          const originFile = originFileName + '.js';
          writeFileSync(
            join(functionDir, main),
            `exports.main = require('./${originFile}').${handlerName};`
          );
        }

        const pkgJsonFile = join(functionDir, 'package.json');
        let pkgJson: any = {};

        if (existsSync(pkgJsonFile)) {
          pkgJson = JSON.parse(readFileSync(pkgJsonFile).toString());
        }

        pkgJson.name = `${cloudFunctionName}`;
        pkgJson.version = projectPkgJson.version || '1.0.0';
        pkgJson.main = 'index.js';
        delete pkgJson.devDependencies;
        writeFileSync(pkgJsonFile, JSON.stringify(pkgJson, null, 2));
      }
    },
  };

  async saveRemove(dir: string) {
    if (!existsSync(dir)) {
      return;
    }
    await remove(dir);
  }
}
