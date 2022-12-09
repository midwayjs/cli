import { Provide, ServerlessTrigger, ServerlessTriggerType } from '@midwayjs/decorator';

@Provide()
export class HelloService {
  @ServerlessTrigger(ServerlessTriggerType.HTTP, { path: '/test'})
  async handler(event, obj = {}) {
    return 'hello world';
  }

  @ServerlessTrigger(ServerlessTriggerType.OS, {
    bucket: 'testBuck',
    events: 'oss:0bjectCreated:*',
    filter: {
        prefix: 'pre',
        suffix: 'suf'
    }
  })
  async oss(event, obj = {}) {
    return 'hello world';
  }
}
