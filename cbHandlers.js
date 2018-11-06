const db = require('./db')

const asCallbackFn = (asyncFn) =>
  (call, callback) => asyncFn(call).then(res => callback(null, res)).catch(e => callback(e))

const cbHandlers = (handlers) => {
  const res = {}
  for (let k in handlers) {
    if (handlers.hasOwnProperty(k)) {
      res[k] = asCallbackFn(handlers[k])
    }
  }
  return res
}

const asPromiseFn = (fn) => async (input) => (new Promise(
  (resolve, reject) => {
    fn.apply(
      input,
      (e, res) => {
        if (e) {reject(e)} else {resolve(res)}
      },
    )
  }
))
const promiseClientCall = (client, method, args) => new Promise((resolve, reject) => {
  client[method](args, (e, res) => {if (e) {reject(e)} else {resolve(res)}})
})
const wait = (timeMs) => new Promise((resolve) => setTimeout(resolve, timeMs))

const pgClientQueryAsync = (q, options = []) => new Promise((resolve, reject) => {
  db().then(client => {
    client.query(q, options, (e, res) => {if (e) {reject(e)} else {resolve(res)}})
  }).catch(e => {throw e})
})

module.exports = {
  promiseClientCall,
  asPromiseFn,
  cbHandlers,
  asCallbackFn,
  pgClientQueryAsync,
  wait,
}
