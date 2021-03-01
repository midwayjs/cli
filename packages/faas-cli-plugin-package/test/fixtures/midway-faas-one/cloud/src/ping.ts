import {
  provide,
  func,
  inject,
} from '@midwayjs/faas';

@provide()
@func('ping.handler')
export class ChannelPingHandler {
  async handler() {}
}

@provide()
@func('post.handler')
export class PostPingHandler {
  @inject()
  ctx;

  async handler() {}
}
