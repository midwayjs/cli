import { FaaSContext, func, inject, provide } from '@midwayjs/faas';

@provide()
@func('index.handler')
export class HelloService {

  @inject()
  ctx: FaaSContext;  // context

  @inject()
  xxxxx;

  @inject('params')
  xxxxx2;

  async handler(event, obj = {}) {
    return 'hello world';
  }
}
