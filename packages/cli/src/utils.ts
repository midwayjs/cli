import mi from 'mod-info';
export const checkUpdate = async (npm?: string) => {
  try {
    const pkg = require('../package.json');
    const info = await mi(pkg.name, pkg.version, {
      level: ['minor', 'patch'],
    });
    if (info.update) {
      console.log();
      console.log('*********************************************************');
      console.log();
      console.log('   find new version:');
      console.log(`   ${pkg.version} ==> ${info.version}`);
      console.log();
      console.log('   please reinstall @midwayjs/cli module to update.');
      console.log();
      console.log('   npm i @midwayjs/cli -g');
      console.log();
      console.log('*********************************************************');
      if (info.tips?.length) {
        console.log(' Some tips:');
        for (const tip of info.tips) {
          console.log(`  ${tip}`);
        }
        console.log(
          '*********************************************************'
        );
      }
      console.log();
    }
  } catch (err) {
    console.log('[ Midway ] check update error and skip', err.message);
  }
};
