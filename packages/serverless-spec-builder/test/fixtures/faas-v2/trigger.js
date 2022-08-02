const mod = require('./all');
const express = require('express')
const app = express()
;(async () => {
  await mod.initializer({});
  app.get('/*', (req, res) => {
    mod.handler(req, res, {});
  });
})();