import { Provide, ServerlessTrigger, ServerlessTriggerType } from '@midwayjs/decorator';

@Provide()
export class HelloService {

  @ServerlessTrigger(ServerlessTriggerType.EVENT)
  async handler(event, obj = {}) {
    return 'hello world';
  }
}
