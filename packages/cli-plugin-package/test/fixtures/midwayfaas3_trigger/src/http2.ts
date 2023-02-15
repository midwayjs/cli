import { Provide, Get, Controller, Query } from '@midwayjs/decorator';

@Provide()
@Controller('/ui')
export class UIController {
  @Get('/version/*')
  async query(@Query('mod') mod?: string) {
    return 'test ' + mod;
  }
}
