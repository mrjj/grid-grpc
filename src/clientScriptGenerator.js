#!/usr/bin/env node

/* eslint-disable no-unused-vars,no-eval,no-useless-escape,no-restricted-syntax */

/**
 * @fileOverview: make GRPC client js file
 * inspired by Danby by ericbets
 * https://github.com/ericbets/danby
 */

const protobuf = require('protobufjs');
const Mustache = require('mustache');

const { DEFAULT_ENDPOINT_CONF } = require('../src/constants');

const TEMPLATE = `/**
 * @fileoverview: GRPC Client file auto-generated by gen-web-client.ks
 */

/**
 * Generated code
 */

const GRPCClient = (options) => {
  if (typeof window === 'undefined') {
      window = {
        WebSocket: undefined, 
        location : { port: 80, host: 'localhost', protocol: 'http:' }
      };
  }
  const { wsSchema, urlPath, host, port, webSocketClass } = {
    urlPath: '{{urlPath}}',
    port: window.location.port,
    host: window.location.host,
    wsSchema: window.location.protocol === 'https:' ? 'wss:' : 'ws:',
    webSocketClass: window.WebSocket,
    ...(options || {}),
  };
  return {
{{services}}  };
};


if (typeof exports === 'object') {
  module.exports = GRPCClient;
} else {
  window.GRPCClient = GRPCClient;
}
`;
const SERVICE_TEMPLATE = `    {{serviceName}}: {
{{methods}}    },
`;

const METHOD_TEMPLATE = `      {{methodName}}: (payload, metadata) => new Promise((resolve, reject) => {
        const ws = new webSocketClass(\`\${wsSchema\}//\${host\}\${port ? \`:\${port}\` : ''}\${urlPath}\`);
        ws.onopen = () => ws.send(JSON.stringify({
          service: '{{serviceName}}',
          method: '{{methodName}}',
          payload,
          metadata,
        }));
        ws.onmessage = evt => resolve(JSON.parse(evt.data));
        ws.onerror = reject;
      }),
`;
const searchService = (el = {}, services = {}) => {
  let sc = services;
  if (el && el.nested) {
    const f = el.nested;
    // eslint-disable-next-line no-restricted-syntax
    for (const field in f) {
      if (field !== 'parent') {
        // eslint-disable-next-line no-prototype-builtins
        if (f.hasOwnProperty(field)) {
          if (f[field] instanceof protobuf.Service) {
            sc[field] = f[field];
          } else {
            sc = searchService(f[field], services);
          }
        }
      }
    }
  }
  return sc;
};

const generateClientScript = async (
  protoPath,
  prettyPrint = false,
  wsSchema = DEFAULT_ENDPOINT_CONF.wsSchema,
) => {
  Mustache.escape = v => v;
  const root = await protobuf.load(protoPath);
  const servicesDict = searchService(root);
  let servicesStr = '';
  for (const serviceName in servicesDict) {
    // eslint-disable-next-line no-prototype-builtins
    if (serviceName && servicesDict.hasOwnProperty(serviceName)) {
      const svc = root.lookupService(serviceName);
      const methods = svc.methods;
      let methodsStr = '';
      for (const methodName in methods) {
        // eslint-disable-next-line no-prototype-builtins
        if (methods.hasOwnProperty(methodName)) {
          const method = methods[methodName];
          const view = {
            methodName,
            serviceName,
            requestType: method.requestType,
            responseType: method.responseType,
            wsSchema,
          };
          methodsStr += Mustache.render(METHOD_TEMPLATE, view);
        }
      }
      servicesStr += Mustache.render(SERVICE_TEMPLATE, {
        serviceName,
        methods: methodsStr,
      });
    }
  }
  return Mustache.render(TEMPLATE, {
    services: servicesStr,
    wsSchema: DEFAULT_ENDPOINT_CONF.wsSchema,
    urlPath: DEFAULT_ENDPOINT_CONF.urlPath,
    protoJSON: prettyPrint
      ? JSON.stringify(root.toJSON(), null, 2)
        .split('\n')
        .join('\n  ')
        .replace('`', '\\`')
      : JSON.stringify(root.toJSON())
        .replace('`', '\\`'),
  });
};

module.exports = { generateClientScript };
