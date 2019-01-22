/* eslint-disable no-path-concat,prefer-template,guard-for-in,no-restricted-syntax */
/**
 * @fileOverview GRPC-browser proxy server example
 *
 * based on:  grpc-web-node-server-example
 *            https://github.com/grpc/grpc-web/tree/master/net/grpc/gateway/examples/echo/node-server
 */

const grpc = require('grpc');
const async = require('async');

const logger = require('../src/logger')({ name: 'grpc-example-server' });
const grpcServer = require('../src/grpcServer');
const grpcProxy = require('../src/grpcProxy');

/**
 * @param {!Object} call
 * @return {!Object} metadata
 */
const copyMetadata = (call) => {
  const metadata = call.metadata.getMap();
  const responseMetadata = new grpc.Metadata();
  for (const key in metadata) {
    responseMetadata.set(key, metadata[key]);
  }
  return responseMetadata;
};

/**
 * @param {!Object} call
 * @param {function} callback
 */
const echo = (call, callback) => {
  console.log(call);
  callback(null, {
    message: call.request.message,
  }, copyMetadata(call));
};

/**
 * @param {!Object} call
 * @param {function} callback
 */
const echoAbort = (call, callback) => {
  callback({
    code: grpc.status.ABORTED,
    message: 'Aborted from server side.',
  });
};

/**
 * @param {!{write: function, end: function}} call
 */
const serverStreamingEcho = (call) => {
  const senders = [];

  function sender(message, interval) {
    return (callback) => {
      call.write({ message });
      window.setTimeout(callback, interval);
    };
  }

  for (let i = 0; i < call.request.message_count; i += 1) {
    senders[i] = sender(call.request.message, call.request.message_interval);
  }
  async.series(senders, () => {
    call.end(copyMetadata(call));
  });
};

const DEBUG = false;

// noinspection JSUnusedGlobalSymbols
/**
 * GRPC upstream service conf
 * @constant GRPC_UPSTREAM_CONF
 */
// noinspection JSUnusedGlobalSymbols
const GRPC_UPSTREAM_CONF = {
  service: 'EchoService',
  serviceProtoPath: './example/echo.proto',
  pkg: 'echo',
  wsSchema: 'ws',
  port: 8080,
  host: 'localhost',
  mountUrlPath: '/grpc-ws',
  handlers: {
    echo,
    echoAbort,
    serverStreamingEcho,
  },
};

/**
 * Some local web service conf
 * @constant WEB_UPSTREAM_CONF
 */
const WEB_UPSTREAM_CONF = {
  mountUrlPath: '/',
  host: 'localhost',
  port: 8000,
  httpSchema: 'http',
  wsSchema: 'ws',
};


/**
 * Proxy endpoint conf
 * @constant ENDPOINT_CONF
 */
const ENDPOINT_CONF = {
  host: 'localhost',
  port: 9001,
  httpSchema: 'http',
  wsSchema: 'ws',
  tlsPort: null,
  cert: null,
  key: null,
};

/**
 * Final conf
 * @constant CONF
 */
const CONF = {
  debug: DEBUG,
  endpoint: ENDPOINT_CONF,
  grpc: [GRPC_UPSTREAM_CONF],
  web: [WEB_UPSTREAM_CONF],
};


/**
 * Starts an RPC server that receives requests for the Greeter service at the
 * sample server port
 */
const main = async () => {
  const grpcs = grpcServer(GRPC_UPSTREAM_CONF)
    .listen();
  await grpcProxy(CONF);
  process.on('exit', () => grpcs.kill());
};


main()
  .then(res => (res ? logger.info(res) : null))
  .catch(e => logger.error(e));

