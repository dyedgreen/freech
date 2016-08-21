'use strict';

/**
* UUID
*
* This class makes it easy to represent, generate,
* validate and compare UUIDs. Notice that UUIDs are
* probably not cryptographically safe, hard to guess
* or a sufficient identification.
*
* Notice that this class uses a 'pseudo' UUID format
* containing contaning five random numbers following
* this layout:
* [0 to ffffffff]-[0 to ffff]-[0 to ffff]-[0 to ffff]-[0 to ffffffffffff]
*/
class UUID {

  constructor(uuidString) {
    // Construct form uuid string or generate a new uuid
    if (typeof uuidString === 'string') {
      this.uuid = this.isValid(uuidString) ? this.fromString(uuidString) : this.empty();
    } else {
      this.uuid = this.random();
    }
  }

  /**
  * random() returns a random uuid
  *
  * @return {Array}
  */
  random() {
    return [
      // 8 - 4 - 4 - 4 - 12
      Math.round(Math.random() * 4294967295),
      Math.round(Math.random() * 65535),
      Math.round(Math.random() * 65535),
      Math.round(Math.random() * 65535),
      Math.round(Math.random() * 281474976710655),
    ];
  }

  /**
  * empty() returns an empty uuid
  *
  * @return {Array}
  */
  empty() {
    return [
      // 8 - 4 - 4 - 4 - 12
      0,
      0,
      0,
      0,
      0,
    ];
  }

  /**
  * isValid() returns if a uuid
  * is valid or not
  *
  * @param {string} paramUuidString
  * @return {bool}
  */
  isValid(paramUuidString) {
    const uuid = typeof paramUuidString === 'string' ? paramUuidString : this.toString();
    const regex = /^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/;
    // Test uuid agains regular expression
    return regex.test(uuid);
  }

  /**
  * isEmpty() returns if this uuid
  * is empty or not, this is simply
  * for convenience
  *
  * @return {bool}
  */
  isEmpty() {
    return this.compare(this.empty());
  }

  /**
  * compare() compares this uuid
  * with another uuid
  *
  * @param {} paramCompUuid
  * @return {bool}
  */
  compare(paramCompUuid) {
    // Get the other uuid
    let compUuid = this.empty();
    if (typeof paramCompUuid === 'string') {
      // Parameter is string
      compUuid = this.fromString(paramCompUuid);
    } else if (paramCompUuid instanceof UUID) {
      // Parameter is other UUID
      compUuid = paramCompUuid.uuid;
    } else if (paramCompUuid instanceof Array && paramCompUuid.length === 5) {
      // Parameter is other UUID in array representation
      compUuid = paramCompUuid;
    } else {
      // Wrong type !
      return false;
    }
    // Compare all fields individualy
    return (
      compUuid[0] === this.uuid[0] &&
      compUuid[1] === this.uuid[1] &&
      compUuid[2] === this.uuid[2] &&
      compUuid[3] === this.uuid[3] &&
      compUuid[4] === this.uuid[4]
    );
  }

  /**
  * fromString() creates a uuid
  * array from a string representation.
  * Returns empty uuid if the supplied
  * string is invalid
  *
  * @param {string} paramCompUuid
  * @return {Array}
  */
  fromString(paramUuidString) {
    if (this.isValid(paramUuidString)) {
      const stringArray = paramUuidString.split('-');
      return [
        // 8 - 4 - 4 - 4 - 12
        parseInt(stringArray[0], 16),
        parseInt(stringArray[1], 16),
        parseInt(stringArray[2], 16),
        parseInt(stringArray[3], 16),
        parseInt(stringArray[4], 16),
      ];
    }
    return this.empty();
  }

  /**
  * toString() returns a stringArray
  * representation of this uuid
  *
  * @return {string}
  */
  toString() {
    // Generate the string
    let stringArray = [
      this.uuid[0].toString(16),
      this.uuid[1].toString(16),
      this.uuid[2].toString(16),
      this.uuid[3].toString(16),
      this.uuid[4].toString(16),
    ];
    stringArray.forEach((string, i) => {
      let len = 4;
      if (i === 0) {
        len = 8;
      } else if (i === 4) {
        len = 12;
      }
      if (string.length < len) {
        stringArray[i] = '000000000000'.substr(0, len - string.length).concat(string);
      }
    });
    // Return the string
    return stringArray.join('-');
  }

}


// Export
module.exports = UUID;
