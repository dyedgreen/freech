'use strict';


// Imports
const fs = require('fs');
const http = require('http');

/**
* JsonData
*
* A simple class that makes it easy to retrive json
* data over http / file system. Always returns the
* data in the following format:
* { error: true/false, json: {OBJ from loaded JSON} }
*/
class JsonData {

  /**
  * httpGet() makes a http
  * request, expecting a
  * json to be returned.
  *
  * @param {string} hostname
  * @param {stirng} path
  * @param {Object} headers
  * @param {function} callback(response)
  */
  static httpGet(hostname, path, headers, callback) {
    http.get({
      hostname,
      path,
      headers: Object.assign({ 'User-Agent': 'FreechJSON/1.0 (NodeJS)' }, headers),
    }, res => {
      // Get the data from the server
      let json = '';
      let error = false;
      res.setEncoding('utf8');
      res.on('data', data => {
        json = json.concat(data);
      });
      res.on('end', () => {
        // Process the data
        try {
          json = JSON.parse(json);
        } catch (e) {
          // Catch malformed json
          json = undefined;
          error = true;
        }
        // Pass the data to the callback
        callback({ error, json });
      });
    });
  }

  /**
  * localFile() loads json
  * data from a local file.
  *
  * @param {string} path
  * @param {function} callback(data)
  */
  static localFile(path, callback) {
    // Test if file exists
    fs.access(path, fs.R_OK, err => {
      if (!err) {
        let json = '';
        let error = false;

        const fileRead = fs.createReadStream(path);
        fileRead.setEncoding('utf8');
        fileRead.on('data', data => {
          json = json.concat(data);
        });
        fileRead.on('end', () => {
          // Parse the json and return to the callback
          try {
            json = JSON.parse(json);
          } catch (e) {
            json = undefined;
            error = true;
          }
          callback({ error, json });
        });
      } else {
        callback({ error: true, json: undefined });
      }
    });
  }

  /**
  * localFileSync() same as localFile()
  * but syncronus.
  *
  * @param {string} path
  * @return {object} data
  */
  static localFileSync(path) {
    // Test if file exists
    try {
      fs.accessSync(path, fs.R_OK);
    } catch (e) {
      return { error: true, json: undefined };
    }
    // Read file
    let json = fs.readFileSync(path, 'utf8');
    // Parse json
    try {
      json = JSON.parse(json);
    } catch (e) {
      return { error: true, json: undefined };
    }
    return { error: false, json };
  }

}


// Export
module.exports = JsonData;
