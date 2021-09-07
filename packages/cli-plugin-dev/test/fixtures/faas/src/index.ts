import { provide, func, inject } from '@midwayjs/faas';

@provide()
@func('http.handler')
export class HelloHttpService {

  @inject()
  ctx;

  handler() {
    return 'hello world,' + this.ctx.query.name;
  }
}
