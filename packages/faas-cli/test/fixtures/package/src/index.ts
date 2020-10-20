import { Func, Provide } from '@midwayjs/decorator';

@Provide()
@Func('index.handler')
export class IndexService {
  handler() {
    return 'hello http world';
  }
}
