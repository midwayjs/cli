// command: 在什么命令下加载 tring; mod: 加载那个模块 string; name: 导出的名称 string;
export const PluginList: Array<{
  mod: string;
  name?: string;
  command?: string;
  platform?: string;
  installed?: boolean;
}> = [
  { mod: '@midwayjs/cli-plugin-build', command: 'build', installed: true },
  { mod: '@midwayjs/cli-plugin-dev', command: 'dev', installed: true },
  { mod: '@midwayjs/cli-plugin-faas', command: 'deploy' },
  { mod: '@midwayjs/cli-plugin-faas', command: 'package' },
  { mod: '@midwayjs/cli-plugin-test', command: 'test', installed: true },
  { mod: '@midwayjs/cli-plugin-test', command: 'cov', installed: true },
  { mod: '@midwayjs/cli-plugin-clean', command: 'clean', installed: true },
  { mod: '@midwayjs/cli-plugin-check', command: 'check', installed: true },
  {
    mod: '@midwayjs/cli-plugin-add',
    command: 'new',
    name: 'AddPlugin',
    installed: true,
  },
];
