export const convertMethods = (method: string | string[]) => {
  if (!method || !method.length) {
    return;
  }
  const methods = [].concat(method);
  const upperMthoeds = methods.map(method => {
    return method.toUpperCase();
  });
  if (upperMthoeds.includes('ANY') || upperMthoeds.includes('ALL')) {
    return;
  }
  return upperMthoeds;
};
