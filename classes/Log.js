'use strict';


// Constant values
const logLevelNames = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'FATAL'];
// 'Private' vars shared by all class instances
let logLevel = 0;

/**
* Log
*
* This class provides a single place to
* write logs to the console and to files.
* It can be configured and run from anywhere
* in the program.
*
* TODO: Write logging to file, split in an useful way
*/
class Log {

  /**
  * write() creates a
  * log entry and figures
  * out what to do with it.
  *
  * @param {number/string} level
  * @param {any object} ...
  */
  static write(...args) {
    // Get the specified log-level
    let [level] = args;
    if (typeof level === 'string' && this.levels.hasOwnProperty(level)) {
      level = this.levels[level];
    } else if (typeof level !== 'number') {
      level = 0;
    }
    if (level >= logLevel) {
      // Combine the arguments
      let entry = '';
      args.forEach((obj, index) => {
        if (index === 1) {
          entry = entry.concat(obj);
        } else if (index > 1) {
          entry = entry.concat(' ').concat(obj);
        }
      });
      if (entry !== '') {
        // Format the log
        const levelName = logLevelNames[level];
        const time = new Date().toISOString();

        entry = `[${levelName}][${time}] `.concat(entry);
        // Write the log to console
        console.log(entry);
        // TODO: Write the log to file
      }
    }
  }

  /**
  * setLevel() sets the
  * log level, if the level
  * passed is valid.
  *
  * @param {string} newLevel
  * @return {bool}
  */
  static setLevel(newLevel) {
    if (this.levels.hasOwnProperty(newLevel)) {
      logLevel = this.levels[newLevel];
      return true;
    }
    return false;
  }

  /**
  * levels() returns
  * object with all
  * possible log-levels.
  *
  * @return {obj}
  */
  static get levels() {
    return {
      DEBUG: 0,
      INFO: 1,
      WARNING: 2,
      ERROR: 3,
      FATAL: 4,
    };
  }
  // Fast access
  static get DEBUG() { return this.levels.DEBUG; }
  static get INFO() { return this.levels.INFO; }
  static get WARNING() { return this.levels.WARNING; }
  static get ERROR() { return this.levels.ERROR; }
  static get FATAL() { return this.levels.FATAL; }

  /**
  * level() returns
  * the currently set level
  * of log-reporting.
  *
  * @return {string}
  */
  static get level() {
    return logLevel;
  }

}


// Exports
module.exports = Log;
