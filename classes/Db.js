'use strict';


// Imports
const MongoClient = require('mongodb').MongoClient;

const JsonData = require('./JsonData.js');
const Log = require('./Log.js');

// Constant values
const serverAuth = JsonData.localFileSync(__dirname.replace('/classes', '/secret').concat('/db.json')).json;

// Private valiables, shared by all instances
let sharedConn = {
  open: false,
  db: null,
};

/**
* Db
*
* Provides an interface that helps multiple components
* of the application to share a single DB connection.
*
* This class also provides a convenience method for
* getting a collection by name. Note that the server
* set as 'default' in the db.json config file will
* get a shared connection, that all the Db class
* instances will use.
*/
class Db {

  constructor(callback) {
    // Set the objects properties
    this.conn = {
      open: false,
      db: null,
    };
    this.lastServerConnected = '';
    // Connect to the database
    this.connect(callback);
  }

  /**
  * connect() opens
  * a new database
  * connection (closing the
  * the existing one)
  *
  * @param {function} callback(didConnect)
  */
  connect(callback) {
    // Close the existing database connection
    this.close();

    // Connect to the database
    if (sharedConn.open) {
      // Reuse the shared db connection
      Log.write(Log.DEBUG, 'Shared database connection reused');
      this.conn = sharedConn;
    } else if (serverAuth !== undefined) {
      // Create a new connection
      Log.write(Log.DEBUG, 'Creating database connection');

      // Build the connection url
      let dbUrl = 'mongodb://'.concat(serverAuth.host);
      dbUrl = dbUrl.concat(':').concat(serverAuth.port);
      dbUrl = dbUrl.concat('/').concat(serverAuth.db);

      // Set up the db connection options
      if (serverAuth.options.length > 0) dbUrl.concat('?');
      serverAuth.options.forEach((option, index) => {
        if (index !== 0) dbUrl.concat('&');
        dbUrl.concat(option.n).concat('=').concat(option.v);
      });
      MongoClient.connect(dbUrl, (err, db) => {
        if (!err) {
          // Store the database connection
          this.conn.db = db;
          this.conn.open = true;
          // Store the shared connection
          sharedConn = this.conn;
          Log.write(Log.DEBUG, 'Stored shared database connection');
          // Watch db events
          db.on('error', () => {
            // Some error occured, close db
            this.close();
            Log.write(Log.ERROR, 'Database error, connection closed');
          });

          Log.write(Log.INFO, 'Database connected');
        } else {
          // Report the problem
          Log.write(Log.ERROR, 'Failed to connect to the database');
        }

        // Let the callback know
        if (callback) callback(this.conn.open);
      });
    } else {
      // Server does not exist
      if (callback) callback(this.conn.open);
      // Report the problem
      Log.write(Log.ERROR, 'Database server does not exist');
    }
  }

  /**
  * close() terminates
  * the current db connection.
  */
  close() {
    if (this.conn.open) {
      this.conn.open = false;
      this.conn.db.close();
      this.conn.db = null;
      Log.write(Log.INFO, 'Current database closed');
    }
  }

  /**
  * collection() returns
  * the requested collection
  * or false, if the db is not
  * connected.
  *
  * @param {string} name
  */
  collection(name) {
    if (typeof name === 'string' && this.conn.open) {
      return this.conn.db.collection(name, { strict: false });
    }

    return false;
  }

}


// Exports
module.exports = Db;
