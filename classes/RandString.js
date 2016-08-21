'use strict';


/**
* RandString
*
* Provides util functions for creating random strings that
* can be used as ids and tokens.
*/
class RandString {

  /**
  * arbitrary() generates
  * a string of arbitrary
  * length.
  *
  * @param {number} length
  * @return {string}
  */
  static arbitrary(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let string = '';
    if (typeof length === 'number' && length > 0) {
      for (i = 0; i < length; i ++) {
        string = string.concat(chars.substr(Math.floor(Math.random() * (chars.length - 1)), 1));
      }
    }
    return string;
  }

  /**
  * long() returns a 128
  * char string.
  *
  * @return {string}
  */
  static get long() {
    return RandString.arbitrary(128);
  }

  /**
  * medium() returns a 64
  * char string.
  *
  * @return {string}
  */
  static get medium() {
    return RandString.arbitrary(64);
  }

  /**
  * short() returns a 32
  * char string.
  *
  * @return {string}
  */
  static get short() {
    return RandString.arbitrary(32);
  }

  /**
  * tiny() returns a 16
  * char string.
  *
  * @return {string}
  */
  static get tiny() {
    return RandString.arbitrary(16);
  }

}

// Export
module.exports = RandString;
