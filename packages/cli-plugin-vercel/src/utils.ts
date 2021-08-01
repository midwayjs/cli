export const convertMethods = (method: string | string[]) => {
  if (!method || !method.length) {
    return;
  }
  const methods = [].concat(method);
  return methods.map(method => {
    return method.toUpperCase();
  });
};
