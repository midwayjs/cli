import { startDev, invokeByDev, closeDev } from './common';
import { DevPackOptions } from '@midwayjs/gateway-common-http';
import { NextFunction, Request, Response } from 'express';
import { Context } from 'koa';
import * as koaBodyParser from 'koa-bodyparser';
import * as expressBodyParser from 'body-parser';
import * as compose from 'koa-compose';
import { compose as expressCompose } from 'compose-middleware';
import { IStartOptions } from './interface';

export function useExpressDevPack(options: DevPackOptions) {
  options.functionDir = options.functionDir || process.cwd();
  const invokeFun = async () => {
    return invokeByDev(options.dev);
  };
  return expressCompose([
    expressBodyParser.urlencoded({ extended: false }),
    expressBodyParser.json(),
    async (req: Request, res: Response, next: NextFunction) => {
      const { createExpressGateway } = require('@midwayjs/gateway-common-http');
      const gateway = createExpressGateway(options);
      gateway.transform(req, res, next, invokeFun);
    },
  ]);
}

export function useKoaDevPack(options: DevPackOptions) {
  options.functionDir = options.functionDir || process.cwd();
  const invokeFun = async () => {
    return invokeByDev(options.dev);
  };
  return compose([
    koaBodyParser({
      enableTypes: ['form', 'json'],
    }),
    async (ctx: Context, next: () => Promise<any>) => {
      const { createKoaGateway } = require('@midwayjs/gateway-common-http');
      const gateway = createKoaGateway(options);
      await gateway.transform(ctx, next, invokeFun);
    },
  ]);
}

export function getKoaDevPack(cwd: string, options?: IStartOptions) {
  return wrapDevPack(useKoaDevPack, cwd, options);
}

export function getExpressDevPack(cwd: string, options?: IStartOptions) {
  return wrapDevPack(useExpressDevPack, cwd, options);
}

const wrapDevPack = (
  devPack,
  cwd,
  startOptions: IStartOptions = {}
): ((options: DevPackOptions) => any) => {
  cwd = cwd || process.cwd();
  let devCore;
  startDev(cwd, startOptions).then(core => {
    devCore = core;
  });
  const wrapedDevPack = (options: DevPackOptions) => {
    options.dev = () => {
      return devCore;
    };
    return devPack(options);
  };
  wrapedDevPack.close = async () => {
    return closeDev(devCore);
  };
  return wrapedDevPack;
};
