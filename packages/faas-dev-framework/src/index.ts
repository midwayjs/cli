import {
  BaseFramework,
  IMidwayBootstrapOptions,
  MidwayFrameworkType,
} from '@midwayjs/core';
import { Server } from 'net';
import { readFileSync } from 'fs';
import { join } from 'path';
import { start1, start2 } from './start';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import { getSpecFile, loadSpec } from '@midwayjs/serverless-spec-builder';
import { createExpressGateway } from '@midwayjs/gateway-common-http';
import { findNpmModule, output404 } from './utils';

export class Framework extends BaseFramework<any, any, any> {
  private server: Server;
  private bootstrapOptions;
  private spec;
  async applicationInitialize(options: IMidwayBootstrapOptions) {}

  public getFrameworkName() {
    return 'midway:faas:local';
  }

  public getFrameworkType(): MidwayFrameworkType {
    return MidwayFrameworkType.FAAS;
  }
  public getApplication() {
    return this.app;
  }

  getStarterName() {
    const platform = this.getPlatform();
    if (platform === 'aliyun') {
      return require.resolve('@midwayjs/serverless-fc-starter');
    } else if (platform === 'tencent') {
      return require.resolve('@midwayjs/serverless-scf-starter');
    }
  }

  getTriggerMap() {
    const platform = this.getPlatform();
    if (platform === 'aliyun') {
      return require('@midwayjs/serverless-fc-trigger');
    } else if (platform === 'tencent') {
      return require('@midwayjs/serverless-scf-trigger');
    }
  }

  getPlatform() {
    const provider = this.spec?.provider?.name;
    if (provider) {
      if (provider === 'fc' || provider === 'aliyun') {
        return 'aliyun';
      } else if (provider === 'scf' || provider === 'tencent') {
        return 'tencent';
      }
    }
    return provider;
  }

  async initialize(options: Partial<IMidwayBootstrapOptions>) {
    this.bootstrapOptions = options;
    this.getFaaSSpec();
    this.app = express();
    const { appDir, baseDir } = options;

    const faasModule = '@midwayjs/faas';
    const faasModulePath = findNpmModule(appDir, faasModule);
    if (!faasModulePath) {
      throw new Error(`Module '${faasModule}' not found`);
    }
    const starterName = this.getStarterName();
    if (!starterName) {
      throw new Error('Starter not found');
    }

    const { version } = JSON.parse(readFileSync(join(faasModulePath, 'pacakge.json')).toString());
    const versionList = version.split('.');
    const triggerMap = this.getTriggerMap();
    let decoratorFunctionMap;
    let invoke;
    if (versionList[0] === '2') {
      const { Framework } = require(faasModulePath);
      const startResult = await start2({
        appDir,
        baseDir,
        framework: Framework,
        starter: require(starterName),
        initializeContext: undefined,
      });
      decoratorFunctionMap = startResult.decoratorFunctionMap;
      invoke = startResult.invoke;
    } else if (versionList[0] === '1') {
      const startResult = await start1({
        baseDir,
        starter: require(starterName),
        initializeContext: undefined,
      });
      decoratorFunctionMap = startResult.decoratorFunctionMap;
      invoke = startResult.invoke;
    }

    if (!invoke) {
      throw new Error('This Project not support');
    }

    if (!this.spec.functions) {
      this.spec.functions = {};
    }
    Object.assign(this.spec.functions, decoratorFunctionMap);

    this.app.invoke = invoke;
    this.app.use(bodyParser.urlencoded({ extended: false }));
    this.app.use(bodyParser.json());
    this.app.use((req, res, next) => {
      const gateway = createExpressGateway({
        functionDir: this.appDir,
      });
      gateway.transform(req, res, next, async () => {
        return {
          functionList: this.spec.functions,
          invoke: async args => {
            const trigger = [new triggerMap.http(...args.data)];
            let newArgs = trigger;
            let callBackTrigger;
            if (newArgs?.[0] && typeof newArgs[0].toArgs === 'function') {
              callBackTrigger = trigger[0];
              newArgs = await trigger[0].toArgs();
            }
            const result = await new Promise((resolve, reject) => {
              if (callBackTrigger?.useCallback) {
                // 这个地方 callback 得调用 resolve
                const cb = callBackTrigger.createCallback((err, result) => {
                  if (err) {
                    return reject(err);
                  }
                  return resolve(result);
                });
                newArgs.push(cb);
              }
              Promise.resolve(invoke(args.functionHandler, newArgs)).then(
                resolve,
                reject
              );
            });
            if (callBackTrigger?.close) {
              await callBackTrigger.close();
            }
            return result;
          },
        };
      });
    });

    this.app.use((req, res, next) => {
      res.statusCode = 404;
      res.send(output404(req.path, this.spec.functions));
    });
  }

  private getFaaSSpec() {
    const { appDir } = this.bootstrapOptions;
    const specFileInfo = getSpecFile(appDir);
    this.spec = loadSpec(appDir, specFileInfo);
  }

  public async run() {
    if (this.configurationOptions.port) {
      this.server = require('http').createServer(this.app);
      await new Promise<void>(resolve => {
        this.server.listen(this.configurationOptions.port, () => {
          resolve();
        });
      });
    }
  }
}
