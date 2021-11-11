import * as qs from 'querystring';
export function getHeaderValue(headers, key) {
  const value = headers?.[key];
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

export function getQuery(req) {
  if (!req) {
    return;
  }
  if (req.query) {
    return req.query;
  }

  if (!req.query && req.url?.includes('?')) {
    return qs.parse(req.url.replace(/#.*$/, '').replace(/^.*\?/, ''));
  }
}
