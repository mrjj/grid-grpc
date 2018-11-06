#!/usr/bin/env node
/**
 * Based in Danby proxy by `ericbets`
 * https://github.com/ericbets/danby
 */

const fs = require('fs')
const https = require('https')

const express = require('express')
const expressProxy = require('http-proxy-middleware')
const ExpressWs = require('express-ws')
const grpc = require('grpc')
const helmet = require('helmet')
const protobuf = require('protobufjs')
const Logger = require('./logger')
const logger = Logger({name: 'grpcProxy'})

const {promiseMap} = require('./utils')
const {DEFAULT_ENDPOINT_CONF, DEFAULT_WEB_UPSTREAM_CONF, DEFAULT_GRPC_UPSTREAM_CONF} = require('./constants')

// Global that will be called from eval executions
const services = {}

const getSvcRemote = (svcName) => `services['${svcName}'].remote.${svcName}`

const getSvcConnect = (svcName) => `services['${svcName}'].grpc`

const searchServices = (el = {}, services = {}) => {
  if (el && el.nested) {
    const f = el.nested
    for (const field in f) {
      if (field !== 'parent') {
        if (f.hasOwnProperty(field)) {
          if (f[field] instanceof protobuf.Service) {
            services[field] = f[field]
          } else {
            services = searchServices(f[field], services)
          }
        }
      }
    }
  }
  return services
}

/**
 * Run Proxy
 * @param runConfig {{endpoint: Object, web: ?Array<Object>, grpc: Array<Object>, debug: ?boolean}}
 * @return {Promise<*|Function>}
 */
const runProxy = async (runConfig = {}) => {
  if (!runConfig) {
    throw new Error('No configuration provided for proxy/runProxy method')
  }
  const endpointConf = Object.assign({}, DEFAULT_ENDPOINT_CONF, runConfig.endpoint || {})
  const endpointPathStr = `${endpointConf.host}:${endpointConf.port}`
  const endpointGrpcPathStr = `${endpointConf.wsSchema}://${endpointPathStr}`
  const endpointsDescription = [
    'GRPC Proxy running with following configuration:',
    `- (${endpointConf.httpSchema}|${endpointConf.wsSchema})://${endpointPathStr}    ## Main endpoint`,
  ];

  /**
   * GRPC
   */
  (runConfig.grpc || []).map(
    (grpcUpstreamConf) => {
      const conf = Object.assign({}, DEFAULT_GRPC_UPSTREAM_CONF, grpcUpstreamConf)
      const grpcUpstreamStr = `${conf.wsSchema}://${conf.host}:${conf.port}`
      endpointsDescription.push([
        `- ${grpcUpstreamStr}`,
        '  ->  ',
        `${endpointGrpcPathStr}${endpointConf.grpcMountUrlPath} - ${conf.pkg}.${conf.service}`,
        `    ## GRPC proxy for ${conf.serviceProtoPath}`,
      ].join(''))

      const proto = protobuf.loadSync(grpcUpstreamConf.serviceProtoPath)
      console.log('proto', proto);
      const servicesDict = searchServices(proto)
      const svc = servicesDict[grpcUpstreamConf.service]
      // noinspection JSUnusedLocalSymbols
      const methodNames = Object.keys(svc.methods)
      let stub = null
      eval(`stub = proto.${grpcUpstreamConf.pkg}`)
      services[grpcUpstreamConf.service] = {
        cfg: conf,
        methods: conf.methods,
        remote: stub,
        grpc: grpcUpstreamStr,
      }
    },
  )

  const httpServer = express()
  ExpressWs(httpServer)

  httpServer.use(helmet())

  // WARNING: req param is used is
  // noinspection JSUnusedLocalSymbols
  const websocketHandler = (ws, req) => {
    const debugOn = typeof (runConfig.debug) !== 'undefined' && runConfig.debug === true
    ws.on('message', (msg) => {

      // WARNING! Methods below is used in Eval
      // FIXME: Get rid of `eval` use, replace with dynamic loading
      // eslint-disable-next-line no-unused-vars
      // noinspection JSUnusedLocalSymbols
      function respond (data) {
        const str = JSON.stringify(data)
        if (debugOn) {
          logger.info(`S:${str}`)
        }
        ws.send(str)
        ws.close()
      }

      // eslint-disable-next-line no-unused-vars
      // noinspection JSUnusedLocalSymbols
      function error (e) {
        logger.error(e)
      }

      const obj = JSON.parse(msg)
      const metadata = new grpc.Metadata()

      if (services[obj.service].methods.includes(obj.method) && typeof (obj.payload === 'object')) {
        if (typeof (obj.metadata) !== 'undefined') {
          Object.keys(obj.metadata).forEach((name) => metadata.set(name, obj.metadata[name]))
        }

        const cmd = `client = new ${getSvcRemote(obj.service)}(${getSvcConnect(obj.service)}, grpc.credentials.createInsecure())`

        if (debugOn) {
          logger.info(`C:${cmd}`)
        }

        eval(cmd)

        logger.info('obj[\'method\']', obj.method, obj)
        const call = `client.${obj.method}(${JSON.stringify(obj.payload)}, metadata , function (err, response) { if (err) { error(err); } else { respond(response); } });`
        if (debugOn) {
          logger.info(`C:${call}`)
        }
        eval(call)
      }
    })
  }
  httpServer.ws(endpointConf.grpcMountUrlPath, websocketHandler)

  /**
   * Endpoint TLS conf
   * TODO(ikutukov): verify that certs are working properly
   *
   * @type {*}
   */

  let tlsServer
  if (endpointConf.cert && endpointConf.key) {
    const options = {
      cert: fs.readFileSync(endpointConf.cert),
      key: fs.readFileSync(endpointConf.key),
    }
    tlsServer = https.createServer(options, httpServer)
  }
  Object.assign(httpServer, endpointConf)

  /**
   * Web upstreams
   */
  runConfig.web.forEach((webUpstreamConf) => {
    const conf = Object.assign({}, DEFAULT_WEB_UPSTREAM_CONF, webUpstreamConf)
    const upstreamUrl = `${conf.host}:${conf.port}`
    endpointsDescription.push(`- (${conf.httpSchema}|${conf.wsSchema})://${upstreamUrl}  ->  (${endpointConf.httpSchema}|${endpointConf.wsSchema})://${endpointPathStr}${conf.filter ? '/[DYNAMIC RULES]' : conf.mountUrlPath}    ## Web proxy`)
    if (webUpstreamConf.mountUrlPath) {

      httpServer.use(conf.filter || conf.mountUrlPath, expressProxy({
        ...conf,
        target: `${conf.httpSchema}://${upstreamUrl}`,
        changeOrigin: true,
        ws: true,
        logProvider: (conf) => Logger({...conf, name: 'http-proxy-middleware'}),
      }))
    }
  })

  /**
   * Start
   */
  if (tlsServer) {
    tlsServer.listen(endpointConf.tlsPort)
  }
  httpServer.listen(endpointConf.port)
  endpointsDescription.forEach(ed => logger.info(ed))
  return httpServer
}

module.exports = runProxy
