'use strict';


// Imports
const crypto = require('crypto');

const Log = require('./Log.js');
const RandString = require('./RandString.js');

/**
* User
*
* Rerpesents a user and provides functions
* to test user tocken hashes.
*/
class User {

  constructor(userId, userName) {
    // Store the data
    this.id = userId || '';
    this.name = userName.substr(0, 50) || ''; // A users name can not be longer than 50 chars!
    this.token = User.generateToken();
    // Log about this
    Log.write(Log.DEBUG, 'User created with name / id / token:', this.name, '/', this.id, '/', this.token);
  }

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
  testHash(hash = '', time = 0) {
    // Test age
    if (time < Date.now() - 60000) return false;
    // Test the hash
    const sha256 = crypto.createHash('sha256');
    sha256.update(this.token.concat(time));
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
  */
  static validateName(userName) {
    return typeof userName === 'string' && userName.length > 0;
  }

}

// Export
module.exports = User;
