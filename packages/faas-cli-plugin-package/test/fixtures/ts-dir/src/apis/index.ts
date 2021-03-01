import {
  provide,
  func,
} from '@midwayjs/faas';

@provide()
@func('index.handler')
export class IndexHandler {
  /**
   * 发布为 hsf 时
   * 这个参数是 ginkgo 固定的，入参出参都为字符串
   * @param event
   */
  async handler(event: string) {
    return 'hello';
  }
}
