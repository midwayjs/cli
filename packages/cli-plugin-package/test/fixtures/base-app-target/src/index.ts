import { func, inject, provide } from '@midwayjs/faas';

@provide()
@func('index.handler')
export class HelloService {

  @inject()
  ctx;  // context

  async handler(event, obj = {}) {
    return 'hello world';
  }
}
