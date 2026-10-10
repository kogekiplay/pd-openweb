const API_SERVER: Record<string, string> = {
  local: '/wwwapi/',
};

const WEBPACK_PUBLIC_PATH: Record<string, string> = {
  local: '/dist/pack/',
};

const publicTarget = process.env['PUBLIC'] || '';

module.exports = {
  apiServer: process.env['API_SERVER'] || API_SERVER[publicTarget] || '/wwwapi/',
  webpackPublicPath: process.env['WEBPACK_PUBLIC_PATH'] || WEBPACK_PUBLIC_PATH[publicTarget] || '/dist/pack/',
  API_SERVER,
};
