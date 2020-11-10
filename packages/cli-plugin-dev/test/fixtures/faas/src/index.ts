import { provide, func } from '@midwayjs/faas';

@provide()
@func('http.handler')
export class HelloHttpService {

  handler() {
    return 'hello http worl';
  }
}
