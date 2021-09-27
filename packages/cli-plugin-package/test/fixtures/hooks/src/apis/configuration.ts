import { Configuration } from '@midwayjs/decorator';
import { hooks } from '@midwayjs/hooks';
@Configuration({
  imports: [
    hooks(),
  ]
})
export class AutoConfiguraion {}
