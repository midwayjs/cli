import { Controller, Get, Provide } from '@midwayjs/decorator';

@Provide()
@Controller('/')
export class HomeController {

  @Get('/main')
  async index(ctx) {
    ctx.body = `Welcome to midwayjs!`;
  }
}
