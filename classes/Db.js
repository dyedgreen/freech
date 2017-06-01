'use strict';


// Imports
const MongoClient = require('mongodb').MongoClient;
const GridFSBucket = require('mongodb').GridFSBucket;

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
* TODO: Fix shared conn bug!
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
            // Some error occured, close db, then try to revive (this only makes 100 attempts)
            this.close();
            this.revive(100);
            // Log this
            Log.write(Log.ERROR, 'Database error, connection closed, trying to revive (you may need to restart the server)');
          });
          db.on('close', () => {
            // Test if the db was closed on purpose
            if (this.conn.open) {
              // Close the DB, then try to revive (this trys indefinitely)
              this.close();
              this.revive(0);
              // Tell the log
              Log.write(Log.WARNING, 'Database closed unexpectedly, trying to revive (you may need to restart the server)');
            }
          });

          Log.write(Log.INFO, 'Database connected');
        } else {
          // Try to revive database (100 attempts)
          this.close();
          this.revive(100);
          // Report the problem to log
          Log.write(Log.ERROR, 'Failed to connect to the database (you may need to restart the server)');
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
  * revive() tries to
  * open the db, in case
  * something went wrong.
  * It can be configured to
  * try indefinitely, or for
  * a set number of times.
  *
  * @param {number} attempts
  */
  revive(attempts) {
    // Clean input
    if (typeof attempts !== 'number') attempts = 0;
    let currentAttempt = 0;
    // Try to reconnect every minute
    let reviveLoop = setInterval(() => {
      // Increment attempt
      currentAttempt ++;
      // Log this
      Log.write(Log.INFO, 'Trying to revive database, attempt', currentAttempt);
      // Try to open the DB connection
      this.connect(didOpen => {
        if (didOpen) {
          // Db did open, stop the revive
          clearInterval(reviveLoop);
          Log.write(Log.INFO, 'Database was revived');
        } else if (attempts !== 0 && currentAttempt >= attempts) {
          // Db revive limit reached, stop the revive
          clearInterval(reviveLoop);
          Log.write(Log.INFO, 'Database revive failed (you my need to restart the server)');
        }
      });
    }, 60000);
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

  /**
  * bucket() returns
  * a data-storage bucket that
  * can be used to store files
  * like images.
  *
  * @param {string} name
  */
  bucket(name) {
    if (typeof name === 'string' && this.conn.open) {
      return new GridFSBucket(this.conn.db, { bucketName: name });
    }

    return false;
  }

}


// Exports
module.exports = Db;
