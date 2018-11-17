#!/usr/bin/env node

/* eslint-disable no-unused-vars,no-eval */
/**
 * Based in Danby proxy by `ericbets`
 */

const fs = require('fs');
const http = require('http');
const https = require('https');

const express = require('express');
const expressProxy = require('http-proxy-middleware');
const WebSocket = require('ws');
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const get = require('lodash.get');
const Logger = require('./logger');

const logger = Logger({ name: 'grpcProxy' });

const { DEFAULT_ENDPOINT_CONF, DEFAULT_WEB_UPSTREAM_CONF, DEFAULT_GRPC_UPSTREAM_CONF } = require('./constants');

// Global that will be called from eval executions

/**
 * Run Proxy
 * @param runConfig {{endpoint: Object, web: ?Array<Object>, grpc: Array<Object>, debug: ?boolean}}
 * @return {Promise<*|Function>}
 */
const runProxy = async (runConfig = {}) => {
  const services = {};
  const clients = {};
  if (!runConfig) {
    throw new Error('No configuration provided for proxy/runProxy method');
  }
  const endpointConf = Object.assign({}, DEFAULT_ENDPOINT_CONF, runConfig.endpoint || {});
  const endpointPathStr = `${endpointConf.host}:${endpointConf.port}`;
  const endpointGrpcPathStr = `${endpointConf.wsSchema}://${endpointPathStr}`;
  const endpointsDescription = [
    'GRPC Proxy configuration:',
  ];

  /**
   * GRPC
   */
  (runConfig.grpc || []).map(
    (grpcUConf) => {
      const conf = Object.assign({}, DEFAULT_GRPC_UPSTREAM_CONF, grpcUConf);
      const grpcUpstreamStr = `${conf.wsSchema}://${conf.host}:${conf.port}`;
      endpointsDescription.push(
        `        ${grpcUpstreamStr}  ->  ${endpointGrpcPathStr}${endpointConf.urlPath}    ## "${conf.pkg}.${conf.service}" GRPC proxy`,
      );

      const packageDefinition = protoLoader.loadSync(
        grpcUConf.serviceProtoPath,
        { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true });
      const ClientConstructor = get(grpc.loadPackageDefinition(packageDefinition), grpcUConf.pkg);

      clients[grpcUConf.service] = new ClientConstructor[grpcUConf.service](
        `${grpcUConf.host}:${grpcUConf.port}`,
        grpc.credentials.createInsecure(),
      );
      return clients;
    },
  );

  const app = express();
  app.use(express.static('./example/public'));

  // WARNING: req param is used is
  // noinspection JSUnusedLocalSymbols
  const websocketHandler = (ws, req) => {
    const debugOn = runConfig.debug === true || process.env.DEBUG;
    ws.on('message', (msg) => {
      // FIXME: Get rid of `eval` use, replace with dynamic loading
      const respond = (data) => {
        const str = JSON.stringify(data);
        if (debugOn) {
          logger.info(`RES:${str}`);
        }
        ws.send(str);
        ws.close();
      };

      const error = (e) => {
        logger.error(e);
        const str = JSON.stringify({ error: e.message });
        ws.send(str);
        ws.close();
      };

      const obj = JSON.parse(msg);
      if (debugOn) {
        logger.info(`REQ: ${msg}`);
      }
      const metadata = new grpc.Metadata();
      const client = clients[obj.service];
      if (client) {
        if (typeof (obj.metadata) !== 'undefined') {
          Object.keys(obj.metadata)
            .forEach(name => metadata.set(name, obj.metadata[name]));
        }
        client[obj.method](
          obj.payload,
          metadata,
          (err, response) => { if (err) { error(err); } else { respond(response); } },
        );
      }
    });
  };

  /**
   * Endpoint TLS conf
   * TODO(ikutukov): verify that certs are working properly
   *
   * @type {*}
   */

  let tlsServer;
  if (endpointConf.cert && endpointConf.key) {
    const options = {
      cert: fs.readFileSync(endpointConf.cert),
      key: fs.readFileSync(endpointConf.key),
    };
    tlsServer = https.createServer(options, app);
  }
  Object.assign(app, endpointConf);

  /**
   * Web upstreams
   */
  runConfig.web.forEach((webUpstreamConf) => {
    const conf = Object.assign({}, DEFAULT_WEB_UPSTREAM_CONF, webUpstreamConf);
    const upstreamUrl = `${conf.host}:${conf.port}`;
    endpointsDescription.push(`        ${conf.wsSchema}://${upstreamUrl}  ->  ${endpointConf.wsSchema}://${endpointPathStr}${conf.filter ? '/[DYNAMIC RULES]' : conf.mountUrlPath}    ## WS Proxy`);
    endpointsDescription.push(`        ${conf.httpSchema}://${upstreamUrl}  ->  ${endpointConf.httpSchema}://${endpointPathStr}${conf.filter ? '/[DYNAMIC RULES]' : conf.mountUrlPath}    ## Web proxy`);
    if (webUpstreamConf.mountUrlPath) {
      app.use(
        conf.filter || conf.mountUrlPath,
        expressProxy({
          ...conf,
          target: `${conf.httpSchema}://${upstreamUrl}`,
          changeOrigin: true,
          ws: true,
          logProvider: logConf => Logger({
            ...logConf,
            name: 'http-proxy-middleware',
          }),
        }),
      );
    }
  });

  const server = tlsServer ? https.createServer(app) : http.createServer(app);
  const wss = new WebSocket.Server({
    path: endpointConf.urlPath,
    server,
  });

  wss.on('connection', websocketHandler);
  wss.on('error', (e) => {
    throw new Error(e);
  });
  server.listen(tlsServer ? endpointConf.tlsPort : endpointConf.port);

  /**
   * Start
   */
  endpointsDescription.push('Proxy ready:');
  endpointsDescription.push(`${endpointConf.httpSchema}://${endpointConf.host}:${endpointConf.port}`);
  endpointsDescription.forEach(ed => logger.info(ed));
  return app;
};

module.exports = runProxy;
