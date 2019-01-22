/* @flow */
/* eslint-disable no-prototype-builtins */
const asCallbackFn = asyncFn =>
  (call, callback) => asyncFn(call)
    .then(res => callback(null, res))
    .catch(e => callback(e));

const cbHandlers = (handlers) => {
  const res = {};
  // eslint-disable-next-line no-restricted-syntax
  for (const k in handlers) {
    if (handlers.hasOwnProperty(k)) {
      res[k] = asCallbackFn(handlers[k]);
    }
  }
  return res;
};

const asPromiseFn = fn => async input => (new Promise(
  (resolve, reject) => {
    fn.apply(
      input,
      (e, res) => {
        if (e) { reject(e); } else { resolve(res); }
      },
    );
  },
));
const promiseClientCall = (client, method, args) => new Promise((resolve, reject) => {
  client[method](args, (e, res) => { if (e) { reject(e); } else { resolve(res); } });
});

const wait = timeMs => new Promise(resolve => setTimeout(resolve, timeMs));

module.exports = {
  promiseClientCall,
  asPromiseFn,
  cbHandlers,
  asCallbackFn,
  wait,
};
