const Provide: any = () => 0;
const Inject: any = () => 0;
const Func: any = () => 0;
const Oth: any = () => 0;

interface IResult {
  success: boolean;
  data: number[];
}

@Provide()
export class Test {
  @Inject('context')
  private ctx: any;

  @Oth
  private oth: any;

  @Func('index.handler', { event: 'http', method: 'GET', path: '/api/test' })
  @Func('index.handler', { event: 'http' })
  public async handler(event: {
    d: {
      name: string;
    };
    name: string;
  }): Promise<IResult> {
    console.log(event.d.name, event.name, this.ctx, this.oth);
    return {
      success: true,
      data: [1, 2, 3],
    };
  }
}

@Provide()
export class Test2 {
  @Inject('context')
  private ctx: any;

  public main() {
    console.log(this.ctx);
  }
}

@Provide()
@Func()
export class Test3 {
  public handler() {
    console.log('123');
  }
}

@Provide()
@Func({})
export class Test4 {
  public handler() {
    console.log('123');
  }
}

@Provide()
@Func({ event: 'Oth' })
export class Test5 {
  public handler() {
    console.log('123');
  }
}
