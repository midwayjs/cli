import { Provide, ServerlessTrigger, ServerlessTriggerType, ServerlessFunction } from '@midwayjs/core';

@Provide()
export class LocalTest {
  @ServerlessTrigger(ServerlessTriggerType.HSF, {
    functionName: 'aaa1'
  })
  async hello1() {
    return 'test ';
  }

  @ServerlessTrigger(ServerlessTriggerType.HSF)
  async hello2() {
    return 'test ';
  }

  @ServerlessFunction({
    functionName: 'aaa3'
  })
  @ServerlessTrigger(ServerlessTriggerType.HSF)
  async hello3() {
    return 'test ';
  }

  @ServerlessFunction({
    functionName: 'aaa4'
  })
  @ServerlessTrigger(ServerlessTriggerType.HSF, {
    functionName: 'aaab4'
  })
  async hello4() {
    return 'test ';
  }
}
