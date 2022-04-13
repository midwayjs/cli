import { Provider, Config } from "@midwayjs/decorator";

@Provider()
export class A {
  @Config('configA')
  configA;

  @Config()
  configB;

  @Config('configNotA')
  configNotA;
}