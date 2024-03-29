import { BasePlugin, ICoreInstance } from '@midwayjs/command-core';
export class DeployPlugin extends BasePlugin {
  core: ICoreInstance;
  options: any;
  commands = {
    deploy: {
      usage: 'Deploy to online',
      lifecycleEvents: ['deploy'],
      options: {
        yes: {
          usage: 'continue with yes',
          alias: 'y',
        },
        function: {
          usage: 'select function need to publish',
          shortcut: 'f',
        },
      },
    },
  };

  hooks = {
    'after:deploy:deploy': () => {
      if (this.core.service.custom?.customDomain?.domainName) {
        this.displayDomain();
      }
    },
  };

  displayDomain() {
    const allPaths = [];
    for (const funName in this.core.service.functions) {
      const funInfo = this.core.service.functions[funName];
      for (const event of funInfo?.['events'] ?? []) {
        if (event['http']) {
          allPaths.push((event['http'].path || '/').replace(/\*/g, ''));
        }
      }
    }
    if (!allPaths.length) {
      return;
    }
    const domain = this.core.service.custom.customDomain.domainName.replace(
      /\/$/,
      ''
    );
    if (domain === 'auto') {
      return;
    }
    this.core.cli.log('\nDomain bind: ' + domain);
    for (const path of allPaths) {
      this.core.cli.log(
        `- path bind: http://${domain}/${path.replace(/^\//, '')}`
      );
    }
  }
}
