/**
 * @fileOverview Constants
 */

/**
 * @constant DEFAULT_ENDPOINT_CONF - Default endpoint config
 * @type {{
 *    host: string, port: number, tlsPort: number,
 *    httpSchema: string, wsSchema: string, urlPath: string
 * }}
 */

const DEFAULT_ENDPOINT_CONF = {
  host: 'localhost',
  port: 9001,
  tlsPort: 9443,
  httpSchema: 'http',
  wsSchema: 'ws',
  urlPath: '/grpc-ws',
};

/**
 * @constant DEFAULT_WEB_UPSTREAM_CONF - Default web HTTP|WS upstream config
 * @type {{mountUrlPath: string, port: number, host: string, wsSchema: string, httpSchema: string}}
 */
const DEFAULT_WEB_UPSTREAM_CONF = {
  mountUrlPath: '/',
  port: 8000,
  host: 'localhost',
  wsSchema: 'ws',
  httpSchema: 'http',
};

/**
 * @const DEFAULT_GRPC_UPSTREAM_CONF - Default (HTTP|WS|GRPC) proxy endpoint config
 * @type {{
 *  service: string, serviceProtoPath: string, baseProtoPath: null, pkg: string,
 *  wsSchema: string, port: number, host: string, handlers: {}
 * }}
 */
const DEFAULT_GRPC_UPSTREAM_CONF = {
  service: 'Service',
  serviceProtoPath: './proto/service.proto',
  baseProtoPath: null,  // Not mandatory
  pkg: 'service',

  wsSchema: 'ws',
  port: 8080,
  host: 'localhost',

  handlers: {},
};

/**
 * @constant DEFAULT_CLI_CONFIG - Default cli config
 * @type {{inputProtoFilePath: string, outputJsFilePath: string}}
 */
const DEFAULT_CLI_CONFIG = {
  inputProtoFilePath: './proto/service.proto',
  outputJsFilePath: './dist/grpcClient.js',
  keepOldBuilds: false,
};

const DEFAULT_LOGGER_CONFIG = {
  prettyPrint: true,
};

const DEFAULT_JWT_SETTINGS = {
  secret: null,
};

module.exports = {
  DEFAULT_ENDPOINT_CONF,
  DEFAULT_WEB_UPSTREAM_CONF,
  DEFAULT_GRPC_UPSTREAM_CONF,
  DEFAULT_CLI_CONFIG,
  DEFAULT_LOGGER_CONFIG,
  DEFAULT_JWT_SETTINGS,
};
