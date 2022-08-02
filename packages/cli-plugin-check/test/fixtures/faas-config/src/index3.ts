import { Provider, Func, ServerlessTrigger } from "@midwayjs/decorator";

@Provider()
@Func('a.b')
export class C {
  @ServerlessTrigger({})
 async a() {}
}