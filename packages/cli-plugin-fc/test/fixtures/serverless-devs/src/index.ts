import { Provide, ServerlessTrigger, ServerlessTriggerType } from '@midwayjs/decorator';

@Provide()
export class HelloService {
  @ServerlessTrigger(ServerlessTriggerType.HTTP, { path: '/test'})
  async handler(event, obj = {}) {
    return 'hello world';
  }
}
