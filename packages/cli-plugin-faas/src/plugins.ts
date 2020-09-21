// command: 在什么命令下加载 tring; mod: 加载那个模块 string; name: 导出的名称 string;
export const PluginList: Array<{
  mod: string;
  name?: string;
  command?: string;
  platform?: string;
}> = [
  { mod: '@midwayjs/fcli-plugin-create', name: 'CreatePlugin' },
  { mod: '@midwayjs/fcli-plugin-deploy', name: 'DeployPlugin' },
  { mod: '@midwayjs/fcli-plugin-dev-pack', name: 'DevPackPlugin' },
  { mod: '@midwayjs/fcli-plugin-invoke', name: 'FaaSInvokePlugin' },
  { mod: '@midwayjs/fcli-plugin-package', name: 'PackagePlugin' },
  {
    mod: '@midwayjs/fcli-plugin-fc',
    name: 'AliyunFCPlugin',
    platform: 'aliyun',
  },
  {
    mod: '@midwayjs/fcli-plugin-scf',
    name: 'TencentSCFPlugin',
    platform: 'tencent',
  },
  {
    mod: '@midwayjs/fcli-plugin-aws',
    name: 'AWSLambdaPlugin',
    platform: 'aws',
  },
];
