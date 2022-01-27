export enum MidwayFramework {
  Web = 'web',
  Koa = 'koa',
  Express = 'express',
  FaaS = 'faas',
  Unknown = 'unknown',
}

export const midwayFrameworkInfo = [
  {
    module: '@midwayjs/web',
    type: MidwayFramework.Web,
  },
  {
    module: '@midwayjs/koa',
    type: MidwayFramework.Koa,
  },
  {
    module: '@midwayjs/express',
    type: MidwayFramework.Express,
  },
  {
    module: '@midwayjs/faas',
    type: MidwayFramework.FaaS,
  },
];

export const envConfigFileReg = /^config\.(\w+)\.ts$/g;