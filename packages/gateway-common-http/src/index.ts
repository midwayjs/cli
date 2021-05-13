import { DevPackOptions, InvokeCallback } from './interface';
import { Context } from 'koa';
import { NextFunction, Request, Response } from 'express';
import { parseInvokeOptionsByOriginUrl } from './common';
import { getHeaderValue } from './utils';

export { parseInvokeOptionsByOriginUrl } from './common';
export * from './interface';

export class KoaGateway {
  options: DevPackOptions;

  constructor(options: DevPackOptions) {
    this.options = options;
  }

  async transform(
    ctx: Context,
    next: () => Promise<any>,
    invoke: InvokeCallback
  ) {
    const { invokeOptions, invokeFun = invoke } =
      await parseInvokeOptionsByOriginUrl(this.options, ctx.request, invoke);
    if (!invokeOptions.functionName) {
      await next();
    } else {
      try {
        const result: {
          headers: any;
          statusCode: number;
          body: string;
          isBase64Encoded: boolean;
        } = await invokeFun({
          functionDir: invokeOptions.functionDir,
          functionName: invokeOptions.functionName,
          functionHandler: invokeOptions.functionHandler,
          data: invokeOptions.data,
          sourceDir: invokeOptions.sourceDir,
          incremental: true,
          verbose: invokeOptions.verbose,
        });
        let data;
        ctx.status = result.statusCode;
        if (result.isBase64Encoded) {
          // base64 to buffer
          data = Buffer.from(result.body, 'base64');
        } else {
          try {
            data = JSON.parse(result.body);
          } catch (err) {
            data = result.body;
          }
        }
        for (const key in result.headers) {
          ctx.set(key, getHeaderValue(result.headers, key));
        }
        ctx.body = data;
      } catch (err) {
        ctx.body = err.stack;
        ctx.status = 500;
      }
      await next();
    }
  }
}

export class ExpressGateway {
  options: DevPackOptions;

  constructor(options: DevPackOptions) {
    this.options = options;
  }

  async transform(
    req: Request,
    res: Response,
    next: NextFunction,
    invoke: InvokeCallback
  ) {
    const { invokeOptions, invokeFun = invoke } =
      await parseInvokeOptionsByOriginUrl(this.options, req, invoke);
    if (!invokeOptions.functionName) {
      return next();
    } else {
      invokeFun({
        functionDir: invokeOptions.functionDir,
        functionName: invokeOptions.functionName,
        functionHandler: invokeOptions.functionHandler,
        data: invokeOptions.data,
        sourceDir: invokeOptions.sourceDir,
        incremental: true,
        verbose: invokeOptions.verbose,
      })
        .then(
          (result: {
            headers: any;
            statusCode: number;
            body: string;
            isBase64Encoded: boolean;
          }) => {
            let data;
            res.statusCode = result.statusCode;
            if (result.isBase64Encoded) {
              // base64 to buffer
              data = Buffer.from(result.body, 'base64');
            } else {
              try {
                data = JSON.parse(result.body);
              } catch (err) {
                data = result.body;
              }
            }

            for (const key in result.headers) {
              res.setHeader(key, getHeaderValue(result.headers, key));
            }
            if (res.send) {
              // express
              res.send(typeof data === 'number' ? data.toString() : data);
            } else {
              // connect
              if (typeof data === 'string' || Buffer.isBuffer(data)) {
                res.end(data);
              } else {
                res.end(JSON.stringify(data));
              }
            }
          }
        )
        .catch(err => {
          next(err);
        });
    }
  }
}

export const createKoaGateway = (options: DevPackOptions) => {
  return new KoaGateway(options);
};

export const createExpressGateway = (options: DevPackOptions) => {
  return new ExpressGateway(options);
};
