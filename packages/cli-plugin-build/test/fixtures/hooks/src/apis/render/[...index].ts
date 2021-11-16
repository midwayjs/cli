import { useInject } from '@midwayjs/hooks';

export default async function render() {
  const baseDir = await useInject('baseDir');

  return 'hello:' + baseDir;
}