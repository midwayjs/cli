import { Framework } from '@midwayjs/faas';
import { getFuncList } from '@midwayjs/fcli-plugin-invoke';
import * as koa from 'koa';
import * as Router from '@koa/router';
export class FaaSFramework extends Framework {
  private koaApp;
  async run() {
    const functionDir =
      (this.configurationOptions as any).baseDir || process.cwd();
    const results = await Promise.all([
      super.run(),
      getFuncList({ functionDir }),
    ]);
    const functions = results[1];
    await this.startDevServer(functions);
  }

  async beforeStop() {
    if (this.koaApp?.destroy) {
      this.koaApp.destroy();
    }
  }

  public getApplication() {
    return this.koaApp;
  }

  private async startDevServer(functions = {}) {
    this.koaApp = new koa();
    const router = new Router();
    for (const functionName in functions) {
      const funcInfo = functions[functionName];
      const events = funcInfo.events || [];
      for (const event of events) {
        if (event.http) {
          const methods = [].concat(event.http.method || 'get');
          for (const method of methods) {
            const lowerMethod = method.toLowerCase();
            if (router[lowerMethod]) {
              router[lowerMethod](event.http.path, async (ctx, next) => {
                // const handler = this.handleInvokeWrapper(funcInfo.handler);
                ctx.body = { handler: funcInfo.handler, functionName };
                return next();
              });
            }
          }
        }
      }
    }
    this.koaApp.use(router.routes());
    return new Promise(resolve => {
      this.koaApp.listen((this.configurationOptions as any).port, () => {
        resolve();
      });
    });
  }
}
