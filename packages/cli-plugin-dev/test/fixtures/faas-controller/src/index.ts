import { Provide, Controller, Get } from '@midwayjs/decorator';

@Provide()
@Controller('/')
export class HelloHttpService {

  @Get('/json')
  json() {
    return 'json';
  }

  @Get('/:user_id')
  userId() {
    return 'userId';
  }
}
