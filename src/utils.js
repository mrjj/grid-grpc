const path = require('path');
const fs = require('fs');

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
  return path.join(dn, newFn);
};


/**
 * Works like mkdir -p
 * @param pathToCreate
 * @return {string}
 */
const makePath = pathToCreate => pathToCreate.split(path.sep).reduce(
  (currentPath, folder) => {
    let p = currentPath;
    p += folder + path.sep;
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p);
    }
    return p;
  },
  '',
);

module.exports = { addPrefixExt, makePath };
