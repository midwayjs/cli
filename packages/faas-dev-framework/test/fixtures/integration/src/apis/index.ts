import { provide, func, inject } from '@midwayjs/test-faas-version-1';

@provide()
export class HelloHttpService {
  @inject()
  ctx;

  @func('http.handler', { event: 'http', path: '/hello'})
  handler() {
    return {
      method: this.ctx.method,
      path: this.ctx.path,
      headers: this.ctx.headers,
      query: this.ctx.query,
      body: this.ctx.request.body,
    }
  }
}
