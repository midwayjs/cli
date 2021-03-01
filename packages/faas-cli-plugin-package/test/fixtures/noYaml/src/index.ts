import { Func, Inject, Provide } from '@midwayjs/decorator';

@Provide()
export class Service {

  @Inject()
  ctx;  // context

  @Func('service.handler', { path: '/', event: 'http' })
  async handler() {
    return 'hello world';
  }
}