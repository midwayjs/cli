import { provide, func, inject } from '@midwayjs/faas';

@provide()
@func('http.handler')
export class HelloHttpService {

  @inject()
  ctx;

  handler() {
    const a: string = 2;
    return 'hello world,' + this.ctx.query.name;
  }
}
