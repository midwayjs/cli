// command: 在什么命令下加载 tring; mod: 加载那个模块 string; name: 导出的名称 string;
export const PluginList: Array<{
  mod: string;
  name?: string;
  command?: string;
  platform?: string;
}> = [
  { mod: '@midwayjs/cli-plugin-build', command: 'build' },
  { mod: '@midwayjs/cli-plugin-dev', command: 'dev' },
  { mod: '@midwayjs/cli-plugin-faas', command: 'deploy' },
  { mod: '@midwayjs/cli-plugin-test', command: 'test' },
  { mod: '@midwayjs/cli-plugin-test', command: 'cov' },
  { mod: '@midwayjs/cli-plugin-clean', command: 'clean' },
  { mod: '@midwayjs/cli-plugin-add', command: 'new', name: 'AddPlugin' },
];
