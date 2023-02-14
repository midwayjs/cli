import { Controller, Get, Post } from '@midwayjs/core';

@Controller('/api')
export class LocalHttpTest {
  @Get('/abc')
  async abc() {
    return 'test ';
  }

  @Post('/def')
  async def() {
    return 'test ';
  }
}
