import { func, inject, provide } from '@midwayjs/faas';
import { ServerlessTrigger, ServerlessTriggerType, ServerlessFunction } from '@midwayjs/decorator';

@provide()
export class HelloService {

  @inject()
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
    concurrency: 2
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

  @func('index.handler')
  async handler(event, obj = {}) {
    return 'hello world';
  }

  @func('apiall.handler')
  async apiall(event, obj = {}) {
    return 'apiall:' + this.ctx.path;
  }

  @func('api1.handler')
  async api1(event, obj = {}) {
    return 'api1:' + this.ctx.path;;
  }

  @func('api2.handler')
  async api2(event, obj = {}) {
    return 'api2:' + this.ctx.path;;
  }

  @func('api3.handler')
  async api3(event, obj = {}) {
    return 'api3:' + this.ctx.path;;
  }

  @func('render.handler')
  async render(event, obj = {}) {
    return 'render:' + this.ctx.path;;
  }

  @func('render1.handler')
  async render1(event, obj = {}) {
    return 'render1:' + this.ctx.path;;
  }

  @func('render2.handler')
  async render2(event, obj = {}) {
    return 'render2:' + this.ctx.path;;
  }

  @func('normal1.handler')
  async normal1(event, obj = {}) {
    return 'normal1:' + this.ctx.path;;
  }

  @func('normal2.handler')
  async normal2(event, obj = {}) {
    return 'normal2:' + this.ctx.path;;
  }
}
