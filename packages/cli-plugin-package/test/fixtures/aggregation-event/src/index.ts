import { Provide, Inject, ServerlessTrigger, ServerlessTriggerType, ServerlessFunction } from '@midwayjs/decorator';

@Provide()
export class HelloService {

  @Inject()
  ctx;  // context


  @ServerlessTrigger(ServerlessTriggerType.HTTP, { path: '/trigger/http', method: 'get'})
  @ServerlessTrigger(ServerlessTriggerType.HTTP, { path: '/trigger/http', method: 'post'})
  @ServerlessTrigger(ServerlessTriggerType.HTTP, { path: '/trigger/http2', method: 'get'})
  async httpTrigger() {
    return 'http'
  }

  @ServerlessTrigger(ServerlessTriggerType.HTTP, { path: '/trigger/httpall', method: 'get'})
  @ServerlessTrigger(ServerlessTriggerType.HTTP, { path: '/trigger/httpall', method: 'all'})
  async httpAllTrigger() {
    return 'httpall'
  }

  @ServerlessFunction({
    concurrency: 2,
    timeout: 30,
    initTimeout: 50,
  })
  @ServerlessTrigger(ServerlessTriggerType.OS, { bucket: 'test', events: 'test', filter: { prefix: '', suffix: ''} })
  async ossTrigger() {
    return 'oss'
  }

  @ServerlessTrigger(ServerlessTriggerType.OS, { bucket: 'test', events: 'test', functionName: 'cover-config', filter: { prefix: '', suffix: ''} })
  async coverConfig() {
    return 'oss'
  }

  @ServerlessTrigger(ServerlessTriggerType.HSF)
  async hsfTrigger() {
    return 'hsf'
  }
}
