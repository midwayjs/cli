// command: 在什么命令下加载 tring; mod: 加载那个模块 string; name: 导出的名称 string;
export const PluginList: Array<{
  mod: string;
  name?: string;
  command?: string;
}> = [
  { mod: '@midwayjs/bin-plugin-build', command: 'build' },
  { mod: '@midwayjs/bin-plugin-dev', command: 'dev' },
  { mod: '@midwayjs/bin-plugin-faas' },
];
