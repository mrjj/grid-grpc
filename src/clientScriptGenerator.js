#!/usr/bin/env node

/* eslint-disable no-unused-vars,no-eval,no-useless-escape,no-restricted-syntax */

/**
 * @fileOverview: make GRPC client js file
 * inspired by Danby by ericbets
 * https://github.com/ericbets/danby
 */

const fs = require('fs');
const protobuf = require('protobufjs');
const Mustache = require('mustache');

const { DEFAULT_ENDPOINT_CONF } = require('../src/constants');

const TEMPLATE = `/**
 * @fileoverview: GRPC Client file auto-generated by gen-web-client.ks
 */

/**
 * Third party
 */
{{library}}

const protobuf = require('protobufjs');

const JSON_PROTO = \`{{protoJSON}}\`;

/**
 * Generated code
 */
const getClient = (options) => {
  const { wsSchema, grpcMountUrlPath } = {
    wsSchema: '{{wsSchema}}',
    grpcMountUrlPath: '{{grpcMountUrlPath}}',
    ...(options || {}),
  };
  protobuf.Root.fromJSON(JSON_PROTO);
  return {
{{services}}  };
};

module.exports = getClient;
`;
const SERVICE_TEMPLATE = `    {{serviceName}}: {
{{methods}}    },
`;

const METHOD_TEMPLATE = `      {{methodName}}: data => new Promise((resolve, reject) => {
        const ws = new WebSocket(\`\${wsSchema\}://\${window.location.host\}\${grpcMountUrlPath}\`);
        ws.onopen = () => ws.send(JSON.stringify({
          service: '{{serviceName}}',
          method: '{{methodName}}',
          payload: data,
          metadata: {{metadata}},
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
  protobufJsLibDistPath,
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
            metadata: JSON.stringify({}),
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
    grpcMountUrlPath: DEFAULT_ENDPOINT_CONF.grpcMountUrlPath,
    protoJSON: prettyPrint
      ? JSON.stringify(root.toJSON(), null, 2)
        .split('\n')
        .join('\n  ')
        .replace('`', '\\`')
      : JSON.stringify(root.toJSON())
        .replace('`', '\\`'),
    library: fs.readFileSync(protobufJsLibDistPath),
  });
};

module.exports = { generateClientScript };
