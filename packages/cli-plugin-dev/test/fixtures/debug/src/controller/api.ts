import { Provide, Controller, Get } from '@midwayjs/decorator';

@Provide()
@Controller('/')
export class HomeService {
  @Get('/')
  async hello() {
    return 'Hello Midwayjs';
  }
}
