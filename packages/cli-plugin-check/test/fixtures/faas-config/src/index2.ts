import { Controller } from "@midwayjs/decorator";

@Provider()
@Controller('/')
export class A {
  @Config('configC')
  configC;

  @Config()
  configD;

  @Config('configNotB')
  configNotB;
}