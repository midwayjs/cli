import {
  resolveModule,
  invokeFunction,
  startDev,
  invokeByDev,
  closeDev,
} from './common';
import { DevPackOptions } from '@midwayjs/gateway-common-http';
import { NextFunction, Request, Response } from 'express';
import { Context } from 'koa';
import * as koaBodyParser from 'koa-bodyparser';
import * as expressBodyParser from 'body-parser';
import * as compose from 'koa-compose';
import { compose as expressCompose } from 'compose-middleware';

export function useExpressDevPack(options: DevPackOptions) {
  options.functionDir = options.functionDir || process.cwd();
  let invokeFun = invokeFunction;
  if (options.dev) {
    invokeFun = async () => {
      return invokeByDev(options.dev);
    };
  }
  return expressCompose([
    expressBodyParser.urlencoded({ extended: false }),
    expressBodyParser.json(),
    async (req: Request, res: Response, next: NextFunction) => {
      const gatewayName = 'http';
      const createExpressGateway = resolveModule(gatewayName)
        .createExpressGateway;
      options.originGatewayName = gatewayName;
      const gateway = createExpressGateway(options);
      gateway.transform(req, res, next, invokeFun);
    },
  ]);
}

export function useKoaDevPack(options: DevPackOptions) {
  options.functionDir = options.functionDir || process.cwd();
  let invokeFun = invokeFunction;
  if (options.dev) {
    invokeFun = async () => {
      return invokeByDev(options.dev);
    };
  }
  return compose([
    koaBodyParser({
      enableTypes: ['form', 'json'],
    }),
    async (ctx: Context, next: () => Promise<any>) => {
      const gatewayName = 'http';
      const createKoaGateway = resolveModule(gatewayName).createKoaGateway;
      options.originGatewayName = gatewayName;
      const gateway = createKoaGateway(options);
      await gateway.transform(ctx, next, invokeFun);
    },
  ]);
}

export function getKoaDevPack(cwd, options?) {
  return wrapDevPack(useKoaDevPack, cwd, options);
}

export function getExpressDevPack(cwd, options?) {
  return wrapDevPack(useExpressDevPack, cwd, options);
}

const wrapDevPack = (devPack, cwd, options: any = {}): any => {
  cwd = cwd || process.cwd();
  let devCore;
  options.slient = options.slient ?? true;
  startDev(cwd, options || {}).then(core => {
    devCore = core;
  });
  const wrapedDevPack = options => {
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
