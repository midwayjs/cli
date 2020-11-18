import { FaaSContext, func, inject, provide } from '@midwayjs/faas';

@provide()
export class HelloHttpService {

  @inject()
  ctx: FaaSContext;  // context

  @func('http.handler')
  async handler() {
    return {
      headers: this.ctx.request.headers,
      method: this.ctx.request.method,
      query: this.ctx.request.query,
      path: this.ctx.request.path,
      body: this.ctx.request.body
    }
  }

  @func('a.b')
  async a() {
    return 'abc';
  }

  @func('a.c')
  async c() {
    return '123';
  }
}
