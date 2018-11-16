/**
 * @fileOverview GRPC Node.js server wrapper
 */

const grpc = require('grpc');
const get = require('lodash.get');
const protoLoader = require('@grpc/proto-loader');

const logger = require('./logger')({ name: 'grpcServer' });

/**
 * Return running server object
 * @param config {Object<{
 *    service: string,
 *    serviceProtoPath: string,
 *    pkg: string,
 *    schema: 'ws'|'wss',
 *    grpc: string,
 *    handlers: {[string]: function}
 * }>}
 * @param autoStart = start right after init
 * @return {module:grpc.Server}
 */
const getGrpcServer = (config, autoStart = false) => {
  logger.info(`Loading service config "${config.pkg}.${config.service}" from "${config.serviceProtoPath}"`)
  const packageDefinition = protoLoader.loadSync(
    config.serviceProtoPath,
    {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    },
  );
  const proto = get(grpc.loadPackageDefinition(packageDefinition), config.pkg);
  const server = new grpc.Server();
  server.addService(
    proto[config.service].service,
    config.handlers,
  );
  server.host = config.host;
  server.port = config.port;
  server.bind(`${server.host}:${server.port}`, grpc.ServerCredentials.createInsecure());
  const vanillaStartFn = server.start;
  function startFn(...args) {
    logger.info(`Starting GRPC server: "${config.wsSchema}://${config.host}:${config.port}"`);
    vanillaStartFn.apply(server, args);
    logger.info(`"${config.service}" now listening on: "${config.wsSchema}://${config.host}:${config.port}"`);
    return server;
  }
  server.listen = startFn;
  server.start = startFn;

  if (autoStart) {
    server.start();
  }
  return server;
};

module.exports = getGrpcServer;
