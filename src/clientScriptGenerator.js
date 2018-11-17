#!/usr/bin/env node
'use strict';

/**
 * @fileOverview: make GRPC client js file
 * inspired by Danby by ericbets
 * https://github.com/ericbets/danby
 */

const fs = require('fs');
const protobuf = require('protobufjs');
const Mustache = require('mustache');

const {DEFAULT_ENDPOINT_CONF} = require('../src/constants');


const TEMPLATE = `/**
 * @fileoverview: GRPC Client file auto-generated by gen-web-client.ks
 */

/**
 * Third party
 */
{{library}}

/**
 * Generated code
 */
const protobuf = require('protobufjs');
const getClient = (options) => {
  const { wsSchema, grpcMountUrlPath } = {
    wsSchema: '{{wsSchema}}', 
    grpcMountUrlPath: '{{grpcMountUrlPath}}',
    ...(options || {})
  };
  const root = protobuf.Root.fromJSON({{protoJSON}});
  return {
{{services}}  };
};

module.exports = getClient;
`;
const SERVICE_TEMPLATE = `    {{serviceName}}: {
{{methods}}    }
`;

const METHOD_TEMPLATE = `      {{methodName}}: (data) => new Promise(function(resolve, reject) {
        const ws = new WebSocket(\`\${wsSchema\}://\${window.location.host\}\${grpcMountUrlPath}\`);
        ws.onopen = () => ws.send(JSON.stringify({ 
          service: '{{serviceName}}',
          method: '{{methodName}}',
          payload: data,
          metadata: {{metadata}},
        }));
        ws.onmessage = (evt) => resolve(JSON.parse(evt.data));
        ws.onerror = (e) => { logger.error(e); return reject(e); };
      }),
`;
const searchService = (el = {}, services = {}) => {
  if (el && el.nested) {
    const f = el.nested;
    for (let field in f) {
      if (field !== 'parent') {
        if (f.hasOwnProperty(field)) {
          if (f[field] instanceof protobuf.Service) {
            services[field] = f[field]
          } else {
            services = searchService(f[field], services)
          }
        }
      }
    }
  }
  return services
};

const generateClientScript = async (protoPath, protobufJsLibDistPath, wsSchema = DEFAULT_ENDPOINT_CONF.wsSchema) => {
  Mustache.escape = (v) => v;
  const root = await protobuf.load(protoPath);
  const servicesDict = searchService(root);
  let servicesStr = '';
  for (let serviceName in servicesDict) {
    if (serviceName && servicesDict.hasOwnProperty(serviceName)) {
      const svc = root.lookupService(serviceName);
      const methods = svc['methods'];
      let methodsStr = '';
      for (let methodName in methods) {
        if (methods.hasOwnProperty(methodName)) {
          const method = methods[methodName];
          const view = {
            methodName,
            serviceName,
            metadata: JSON.stringify({}),
            requestType: method['requestType'],
            responseType: method['responseType'],
            wsSchema,
          };
          methodsStr += Mustache.render(METHOD_TEMPLATE, view)
        }
      }
      servicesStr += Mustache.render(SERVICE_TEMPLATE, {
        serviceName: serviceName,
        methods: methodsStr,
      })
    }
  }
  return Mustache.render(TEMPLATE, {
    services: servicesStr,
    wsSchema: DEFAULT_ENDPOINT_CONF.wsSchema,
    grpcMountUrlPath: DEFAULT_ENDPOINT_CONF.grpcMountUrlPath,
    protoJSON: JSON.stringify(root.toJSON(), null, 2).split('\n').join('\n  '),
    library: fs.readFileSync(protobufJsLibDistPath)
  })
};

module.exports = {generateClientScript};
