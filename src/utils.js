'use strict';
const path = require('path');
const fs = require('fs');

/**
 * Chains functions returning promises
 *
 * @param functionsReturningPromise - list of functions returning promise
 * @param defaultData
 * @returns {Promise.<T>}
 */
// eslint-disable-next-line
const _chainPromises = (
  functionsReturningPromise,
  defaultData,
) => new Promise((resolve, reject) => {
  let p = Promise.resolve(defaultData);
  functionsReturningPromise.forEach((func) => {
    p = p.then(func, reject);
    return p;
  });
  p.then(resolve, reject);
});

/**
 * Mapper + promise chain
 *
 * @example: Sleep down with increasing delays of naps
 *
 * await cpMap(
 *   [1, 2, 4, 8],
 *   (delaySec) => new Promise((resolve) => {
 *     setTimeout(resolve, delaySec * 1000);
 *   })
 * );
 *
 * console.warning('A? Chto?! Skolko vremeni?');
 *
 * Underscore/LoDash performance note:
 *
 * Underscore is used for execution performance optimisation.
 * https://jsperf.com/native-map-vs-lodash-map
 * Under the hood _ iteration tools gives 1. own properties check skip
 * But addin extra fn lookup constant delay that would be picked up
 * by V8 depending on step execution behaviour.
 * https://www.youtube.com/watch?v=cD9utLH3QOk
 *
 * @param values - array of values
 * @param fn - function returning promises
 * @returns {Promise<Array>}
 */
const promiseMap = async (values, fn) => {
  const results = [];
  await _chainPromises(
    values.map(
      (value, idx) => (v => async () => {
        const res = await fn(v, idx);
        results.push(res);
        return res;
      })(value),
    ),
  );
  return results;
};


/**
 * Add file extension before last one
 *
 * @example
 * addExt('./server.js.log', 'old')
 * > './server.js.old.log'
 *
 * @param p {string} - path
 * @param prefix {string} - new prefix extension
 * @return {string}
 */
const addPrefixExt = (p, prefix = 'old') => {
  const dn = path.dirname(p);
  const fn = path.basename(p);
  const pathParts = fn.split('.');
  const newFn = [
    ...pathParts.slice(0, pathParts.length - 1),
    prefix,
    pathParts[pathParts.length - 1],
  ].join('.');
  return path.join(dn, newFn)
};


/**
 * Works like mkdir -p
 * @param pathToCreate
 * @return {string}
 */
const makePath = (pathToCreate) => pathToCreate.split(path.sep).reduce(
  (currentPath, folder) => {
    currentPath += folder + path.sep;
    if (!fs.existsSync(currentPath)) {
      fs.mkdirSync(currentPath)
    }
    return currentPath
  },
  ''
);

module.exports = { promiseMap, addPrefixExt, makePath };
