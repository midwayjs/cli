import {
  provide,
  func,
  FunctionHandler,
  inject,
} from '@midwayjs/faas';

@provide()
@func('path.handler')
export class PathHandler implements FunctionHandler {
  @inject()
  ctx: any;

  async handler() {
    this.ctx.body = `${this.ctx.params.name},hello http world`;
  }
}
