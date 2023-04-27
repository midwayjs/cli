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

  if (!req.query) {
    let url;
    if (req.originalUrl?.includes('?')) {
      url = req.originalUrl;
    } else if (req.url?.includes('?')) {
      url = req.url;
    }
    if (url) {
      return qs.parse(url.replace(/#.*$/, '').replace(/^.*\?/, ''));
    }
  }
}

export function getPath(req) {
  if (!req) {
    return '';
  }
  if (req.path) {
    return req.path;
  }
  const url = req.url || req.originalUrl || '';
  return url.replace(/(\?|#).*$/, '');
}
