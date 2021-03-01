import { Func, Inject, Provide } from '@midwayjs/decorator';
import { FaaSContext } from '@midwayjs/faas';

@Provide()
export class Service {

  @Inject()
  ctx: FaaSContext;  // context

  @Func('service.handler', { path: '/', event: 'http' })
  async handler() {
    return 'hello world';
  }
}