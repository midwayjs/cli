import { hooks } from '@midwayjs/hooks';
import { Configuration } from '@midwayjs/decorator';
@Configuration({
  imports: [hooks()],
  importConfigs: [],
})
export class AutoConfiguraion {}
