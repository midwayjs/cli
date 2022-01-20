try {
  const {
    postInstall,
    postInstallModule,
    formatModuleVersion,
  } = require('@midwayjs/command-core');
  (async () => {
    const info = await postInstall();
    const version = formatModuleVersion(
      info && info.deps['@midwayjs/faas']
    ).major;
    if (!version) {
      return;
    }
    await postInstallModule([
      { name: '@midwayjs/serverless-app', version },
      { name: '@midwayjs/serverless-fc-starter', version },
      { name: '@midwayjs/serverless-fc-trigger', version },
    ]);
  })();  
} catch (e) {}