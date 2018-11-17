/* eslint-disable */
// this example demonstrates how to consume a streaming rpc service.
window.stream = () => {
  // Current work based on:
  const JSON_PROTO = '{"nested":{"echo":{"nested":{"EchoRequest":{"fields":{"message":{"type":"string","id":1}}},"EchoResponse":{"fields":{"message":{"type":"string","id":1}}},"ServerStreamingEchoRequest":{"fields":{"message":{"type":"string","id":1},"messageCount":{"type":"int32","id":2},"messageInterval":{"type":"int32","id":3}}},"ServerStreamingEchoResponse":{"fields":{"message":{"type":"string","id":1}}},"EchoService":{"methods":{"Echo":{"requestType":"EchoRequest","responseType":"EchoResponse"},"ServerStreamingEcho":{"requestType":"ServerStreamingEchoRequest","responseType":"ServerStreamingEchoResponse","responseStream":true}}}}}}}';


  const protobuf = window.protobuf || require('protobufjs');
  const root = protobuf.Root.fromJSON(JSON.parse(JSON_PROTO));
  // Get its types:

  const EchoService = root.lookup('EchoService');
  const ServerStreamingEcho = root.lookup('ServerStreamingEcho');

  const reqType = ServerStreamingEcho.requestType;
  const resType = ServerStreamingEcho.responseType;

  const urlPath = '';
  const echo = EchoService.create(
    (() => {
      const performRequestOverTransportChannel = (requestData, callback) => {
        const ws = new WebSocket(`${wsSchema}://${window.location.host}${urlPath}`);
        const request = reqType.encodeDelimited(requestData);
        ws.onopen = () => ws.send(JSON.stringify({
          service: 'EchoService',
          method: 'Echo',
          payload: request,
          metadata: {},
        }));
        ws.onmessage = evt => callback(resType.decodeDelimited(evt.data));
        ws.onerror = reject;

        // setTimeout(/* simulated delay */() => {
        //   // 1. server decodes the request
        //   // 2. server handles the request and creates a response
        //   const response = { message: `Hello ${request.message}` };
        //   setTimeout(/* simulated delay */() => {
        //     // 3. server encodes and sends the response
        //     callback(ServerStreamingEchoResponse.encodeDelimited(response).finish());
        //   }, Math.random() * 250);
        // }, Math.random() * 250);
      };

      let ended = false;
      // Method.responseStream
      // Method.requestStream
      return function myRPCImpl(method, requestData, callback) {
        if (ended) {
          return;
        }
        if (!requestData) {
          ended = true;
          return;
        }
        // in a real-world scenario, the client would now send requestData to a server using some
        // sort of transport layer (i.e. http), wait for responseData and call the callback.
        performRequestOverTransportChannel(requestData, (responseData) => {
          callback(null, responseData);
        });
      };
    })(),
    true, // requestDelimited?
    true, // responseDelimited?
  );


  echo.on('data', (response, method) => {
    console.log(`data in ${method.name}:`, response.message);
  });

  echo.on('end', () => {
    console.log('end');
  });

  echo.on('error', (err, method) => {
    console.log(`error in ${method.name}:`, err);
  });

  // Call methods:

  echo.serverStreamingEcho({ message: 'one' });
  echo.serverStreamingEcho(reqType.create({ message: 'two' })); // or use runtime messages

  // Listen to and emit your own events if you like:

  echo.on('status', (code, text) => {
    console.log('custom status:', code, text);
  });

  echo.emit('status', 200, 'OK');

  // And, if applicable, end the service when you are done:

  // setTimeout(() => {
  //   echo.end();
  //   // ^ Signals rpcImpl that the service has been ended client-side by calling it with a null buffer.
  //   //   Likewise, rpcImpl can also end the stream by calling its callback with an explicit null buffer.
  //   echo.serverStreamingEcho({ message: 'Bye' }, (err) => {
  //     console.error(`this should fail: ${err.message}`);
  //   });
  // }, 501);
};
