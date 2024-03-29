import { Configuration } from "@midwayjs/decorator";
import { join } from "path";
@Configuration({
  importConfigs: [join(__dirname, './config/config.default.ts')],
  conflictCheck: true,
})
export class ConfigurationClass {}
