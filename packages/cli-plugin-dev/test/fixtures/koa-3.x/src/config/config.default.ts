import { MidwayConfig } from '@midwayjs/core';

const config: MidwayConfig = {};

// use for cookie sign key, should change to your own and keep security
config.keys = '1642993627247_5877';

config.koa = {
  port: 8080,
};

export default config;
