'use strict';


// Imports
const crypto = require('crypto');

const Log = require('./Log.js');
const RandString = require('./RandString.js');

/**
* User
*
* Provides functions
* to test user token hashes.
*/
class User {

  /**
  * testHash() checks a supplied
  * hash for whether it matches this
  * user. A hash my not be older than
  * 60 seconds or from the future.
  * The hash is a sha256 of the string:
  * {USER-TOKEN}{UNIX}
  *
  * @param {string} hash the hash that will be checked
  * @param {number} time the unix time (milliseconds) at which the hash was created
  * @return {bool}
  */
  static testHash(token = '', hash = '', time = 0) {
    // Test age
    if (time < Date.now() - 60000) return false;
    // Test the hash
    const sha256 = crypto.createHash('sha256');
    sha256.update(token.concat(time));
    return sha256.digest('hex') == hash;
  }

  /**
  * generateToken() creates a new
  * user token randomly.
  *
  * @return {string}
  */
  static generateToken() {
    return RandString.long;
  }

  /**
  * validateId() tests if a users
  * id is valid. (User IDs are
  * generated on the client side).
  *
  * @param {any} userId
  * @return {bool}
  */
  static validateId(userId) {
    return /^[a-zA-Z\d]{128}$/.test(''.concat(userId));
  }

  /**
  * validateName() tests if
  * a users name is valid.
  *
  * @param {string} userName
  * @return {bool}
  */
  static validateName(userName) {
    // The users name must be a string, must not be empty, must not consist of only whitespace characters
    return typeof userName === 'string' && userName.length > 0 && !/^[\s\t\n\r]*$/i.test(userName);
  }

}

// Export
module.exports = User;
