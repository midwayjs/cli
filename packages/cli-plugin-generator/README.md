# Midway CLI Generator Docs

## 快速开始

```bash
# 安装 CLI Generator 插件
npm install @midwayjs/cli-plugin-generator -D
yarn add @midwayjs/cli-plugin-generator -D
pnpm install @midwayjs/cli-plugin-generator -D

# 执行 Generator
midway-bin gen controller --class user
midway-bin gen middleware --class user --framework egg --external
midway-bin gen orm entity --class user --activeRecord
midway-bin gen prisma
```

## 基本使用

```bash
midway-bin gen <generator> <sub-generator> --options
```

- `<generator>`：需要调用的 generator，如 controller / orm / service / sls(serverless) 等。
- `<sub-generator>`：部分 generator 下存在子命令，如 orm 中，你可以执行 `midway-bin gen orm setup` 来完成 `TypeORM` 相关的依赖安装与导入初始化，或者执行 `midway-bin gen orm entity --class user` 来创建 `entity/user.entity.ts` 文件，其中包含 TypeORM 的 Entity 定义。
- `--options`，不同的 generator 或者是同一 generator 下的不同 sub-generator 消费的选项可能是不同的，详见最下方的 **Generator 及 API 一览**。

## 基于 Midway CodeMod 定制 Generator

## 当前可用 Generator 及 API 一览

### 全局-通用选项

- dry：以 `dry run` 模式执行 generator，会提示将要发生的变更而不是真的应用到项目中。推荐在项目结构复杂时，添加 `--dry` 选项来查看是否会有问题产生。与实际运行存在以下区别：
  - 跳过依赖检查（后续 dry run 模式也将进行依赖检查，但不会进行安装）。
  - 不会具体提示将要发生的源码转换。
  - 在结束后，显示本次 generator 运行时传入的参数。
  - 【未实现】在虚拟文件系统中应用变更来真正的查看 generator 能否正确执行。
- 【未实现】cn：将全局的 log 信息替换为中文
- 【未实现】npm：显式指定将要使用的包管理器，默认情况下，在安装依赖的场景将会通过检查项目中的 `yarn.lock` / `package-lock.json` / `pnpm-lock.yaml` 来决定使用的包管理器。
- 【未实现】verbose：打印每一步执行的详细信息。

### 创建-通用选项

> 这里的选项在大部分存在创建文件行为的 generator 中都适用。

- class：生成文件的 Class Identifier。由于 Midway 中大部分组件以 Class 的形式存在，因此这里统一使用 `--class CUSTOM_NAME` 的形式。如使用 `midway-bin gen controller --class user` 会生成名为 `User` 的 Class。

- dir：指定文件的生成目录，处于 `PROJECT/src` 下。如果不指定则会使用默认的文件夹命名，如 `midway-bin gen controller` 默认会生成文件到 `src/controller` 下，`midway-bin gen orm entity` 默认会生成文件到 `src/entity` 下。

- file：指定文件命名。在不指定的情况下，会默认使用 `--class` 的值作为文件命名。如使用 `midway-bin gen controller --class user` 会生成 `user.controller.ts` ，而 `midway-bin gen controller --class user --file not-user` 会生成 `not-user.controller.ts` 。

- dotFile：使用 `x.type.ts` 的文件命名方式，如 `user.controller.ts` / `user.service.ts` / `user.entity.ts` 等。存在此默认行为的 generator 包括：

  - controller
  - service
  - orm:entity
  - orm:subscriber
  - ws:controller

- 【未实装】override：在目标位置已存在同名文件时，是否强制覆盖。

  > 这一选项还未应用到所有的 generator。

### 初始化（setup）-通用选项

- namespace：在执行 setup 命令（如 `midway-bin gen orm setup` ）或仅具有 setup 功能（如 `midway-bin gen axios` ）的 generator 时，将会把相关的组件导入语句添加到 `src/configuration.ts` 中，默认情况下其**命名空间导入**的值与组件同名，如`import * as orm from "@midwayjs/orm"`。使用 namespace 选项来修改命名空间的值。如 `--namespace typeorm` 将会生成 `import * as typeorm from "@midwayjs/orm` 语句。

  - 注意，由于注册组件的过程还包括在 `@Configuration` 装饰器中的参数中注册，如：

    ```typescript
    @Configuration({
      imports: [orm],
      importConfigs: [join(__dirname, './config')],
      conflictCheck: true,
    })
    ```

    因此 namespace 选项也会影响实际被添加到 `imports` 中的值。

### 内置组件

> 如果没有特别指出，则此 generator 支持所有**写入-通用选项**。

- [x] Controller

  - [x] light：默认为 `false`，生成的 controller 中将只包含简单的代码。

- [x] Service

- [x] Debug (`.vscode/launch.json`)

  - [x] port：指定 launch.json 中使用的端口
  - [x] name：指定 launch.json 中 configuration 的配置名

  如果已存在相同 name，则会在 configuration 数组中新增一项。

- [x] Middleware
  - [x] external 在生成的 middleware 中，使用外部导入的 npm 包作为中间件逻辑。
  - [x] framework 指定目标框架，egg / koa / express。
  - [x] functional 使用函数式中间件，仅在 `--framework egg` 下有效。
- [ ] Serverless

  > 见 [Midway-Serverless](https://www.yuque.com/midwayjs/midway_v2/serverless_introduction)。

  > 不支持 dotFile 选项

  - [x] type：faas（普通单个函数） / aggr（聚合部署）
  - [x] http / gateway / event / timer / oss ：仅在 `--type faas`时生效，配置生成的函数中要使用的触发器。分别代表 Http 触发器、API 网关触发器、事件触发器、定时触发器以及 OSS 触发器。默认只会应用 http 触发器。

- [ ] Interceptor

- [ ] 一体化项目支持

### 外部组件（midway-components）

- [x] TypeORM

  - [x] （sub-generator）setup：将安装 `@midwayjs/orm` 与 `sqlite`，并完成相关导入与注册。
  - [x] （sub-generator）entity：生成新的 TypeORM Entity。
    - [x] activeRecord：生成的 Entity Class 将使用 Active Record 模式，即 Class 将实现 `BaseEntity` 。默认为 true。
    - [x] relation：生成的 Entity Class 将带有 TypeORM 级联相关的装饰器示例。默认为 true。
  - [x] （sub-generator）subscriber：生成新的 TypeORM Entity Subscriber。
    - [x] transaction：生成的 Subscriber 将监听事务操作。默认为 true。

- [x] Axios 仅 setup，将安装 `@midwayjs/axios`，并完成相关导入与注册。直接使用 `midway-bin gen axios 即可`。

- [x] Cache 同 Axios。将安装 `@midwayjs/cache-manager` `cache-manager` 以及 `@types/cache-manager`。

- [x] OSS 同 Axios。将安装 `@midwayjs/oss` 以及 `@types/ali-oss`。

- [x] 【实验性功能】Prisma：安装 `@prisma/client` `prisma` ，并完成 Prisma Client 生成、实例化、注册等功能，添加 NPM Scripts。

  - [x] initSchema：在初始化完毕后，添加初始 Prisma Model 定义到 `src/prisma/schema.prisma` 中。

  - [x] initClient：需要同时启用 initSchema 。直接执行初始化的 `prisma db push` ，生成 SQLite 文件 与 Prisma Client。同时会在 `src/configuration.ts` 中，完成实例化与注册相关操作，如：

    ```typescript
    import { PrismaClient } from '@prisma/client';

    const client = new PrismaClient();

    @Configuration({
      importConfigs: [join(__dirname, './config')],
      conflictCheck: true,
    })
    export class ContainerLifeCycle implements ILifeCycle {
      @App()
      app: Application;

      async onReady() {
        client.$connect();
        this.app.getApplicationContext().registerObject('prisma', client);
      }
    }
    ```

- [x] Swagger 同 Axios。将安装 `@midwayjs/swagger` 与 `swagger-ui-dist`。

  - [x] ui：是否要在服务端输出 Swagger UI。如果开启，将会把 `swagger-ui-dist` 安装为 `dependencies`，否则安装到 `devDependencies`。

- [x] WebSocket

  - [x] （sub-generator）setup：将安装 `@midwayjs/ws` ，并完成相关导入与注册。同时会生成 `ws-bootstrap.js` 文件，以及相关的使用此初始化文件启动的 NPM Script，用于 WebSocket 应用启动。
  - [x] （sub-generator）controller：将生成 WebSocket Controller。

- [ ] GraphQL：基于 TypeGraphQL 与 Apollo-Server。

  - [ ] （sub-generator）setup：安装相关依赖、生成 GraphQL 中间件并注册。
  - [ ] （sub-generator）object：生成 ObjectType 文件。
  - [ ] （sub-generator）input：生成 InputType 文件。
  - [ ] （sub-generator）resolver：生成 （Field）Resolver 文件。
  - [ ] （sub-generator）utils：生成 Scalar / Extension / Union 等。

- [ ] Task

- [ ] gRPC

- [ ] RabbitMQ

- [ ] MongoDB
