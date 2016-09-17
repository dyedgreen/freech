'use strict';


// Imports
const http = require('http');
const https = require('https');
const fs = require('fs');

const Log = require('./Log.js');
const Url = require('./Url.js');
const ChatManager = require('./ChatManager.js');

const sslOptions = {
  key: fs.readFileSync(__dirname.replace('/classes', '/ssl').concat('/server.key')),
  cert: fs.readFileSync(__dirname.replace('/classes', '/ssl').concat('/server.crt')),
};

/**
* ChatServer
*
* This class creates the actual server that connects to
* the reactions api, as well as serving static files from
* a specified directory.
* A very, very simple HTTP(S) file server is included that
* serves static files and supports the following special files:
* index.html  -- index file
* 404.html    -- error file
*/
class ChatServer {

  constructor(port, fileDir, useSSL) {
    // Set the specified file directory (or fallback to the custom one)
    this.fileDir = __dirname.replace('/classes', '').concat(fileDir || '/web');
    // Setup the http(s) server, https is standart
    this.serverPort = port || (useSSL === false ? 80 : 443);
    this.serverUsesSSL = !(useSSL === false);
    if (useSSL === false) {
      this.server = http.createServer();
    } else {
      this.server = https.createServer(sslOptions);
    }

    // Hook up all the callbacks
    this.server.on('request', (req, res) => {
      this.handleRequest(req, res);
    });

    // Set up the chat manager
    this.chatManager = new ChatManager();
    // Log about this
    Log.write(Log.DEBUG, 'Chat server instance created, ssl:', this.serverUsesSSL);
  }

  /**
  * open() makes the
  * server listen on the
  * specified port. (You can
  * pass a new port if you
  * changed your mind about the
  * last one)
  *
  * @param {number} newPort
  */
  open(newPort) {
    // Test if the server is already listening to events
    if (this.server.listening) {
      return;
    }

    // Test if the newPort is a number, apply it if it is
    if (typeof newPort === 'number') {
      this.serverPort = newPort;
    }
    // Start up the server
    this.server.listen(this.serverPort);
    // Start the real-time server
    this.chatManager.open(this.server);
    // Log about this
    Log.write(Log.INFO, 'Chat server instance opened at port', this.serverPort);
  }

  /**
  * close() terminates the
  * server. Nothing happens
  * if it's already not
  * listening. The callback
  * will not be called if
  * the server was alredy closed.
  *
  * @param {function} callback
  * @param {function} callbackChatManager
  */
  close(callback, callbackChatManager) {
    // Do nothing if already closed
    if (!this.server.listening) return;
    // Trigger the callback once if the server closes
    this.server.once('close', callback);
    this.server.close();
    // Close the real-time server
    this.chatManager.close(callbackChatManager);
    // Log about this
    Log.write(Log.INFO, 'Chat server instance closed at port', this.serverPort);
  }

  /**
  * handleRequest() is the callback
  * called on client connections. This
  * is an internal function, do not call it.
  *
  * @param {IncomingMessage} req
  * @param {ServerResponse} res
  */
  handleRequest(req, res) {
    // Log about this
    Log.write(Log.DEBUG, 'Chat server request recived');
    // Evaluate url / catch special endpoints
    const url = new Url(req.url);
    const endpoint = url.path.length > 0 ? url.path[0] : '';
    switch (endpoint) {
      case 'api': {
        // The call goes to the api, determine the correct endpoint
        this.chatManager.resolve(url, res);
        break;
      }
      default: {
        // Nothing special here, serve a static file
        this.handleFile(req, res);
        break;
      }
    }
  }

  /**
  * handleFile() serves a file or
  * a 404 error, if that file does
  * not exist.
  *
  * @param {IncomingMessage} req
  * @param {ServerResponse} res
  */
  handleFile(req, res) {
    // Construct file path, considering special files
    let path = this.fileDir.concat(req.url.split('?')[0]);
    switch (req.url.split('?')[0]) {
      // Index file (index.html)
      case '/': {
        path = path.concat('index.html');
        break;
      }
      // Chat web-app
      case '/chat' : {
        path = path.concat('.html');
        break;
      }
      default: {
        break;
      }
    }

    // Does the requested file exist?
    fs.access(path, fs.R_OK, (err) => {
      if (err) {
        this.fileError(req, res);
        return;
      }
      // Determine the content-type of the file
      res.writeHead(200, {
        'Content-type': this.getContentTypeForPath(path),
      });
      // Serve the file to the client
      fs.createReadStream(path).pipe(res);
    });
    // Log about this
    Log.write(Log.DEBUG, 'Chat server tried to serve file for path', path);
  }

  /**
  * fileError() serves an
  * error file (404.html)
  *
  * @param {http.IncomingMessage} req
  * @param {http.ServerResponse} res
  */
  fileError(req, res) {
    // Does the error file exist?
    const errorFile = this.fileDir.concat('/404.html');
    fs.access(errorFile, fs.R_OK, (err) => {
      // Determine the content-type of the file
      res.writeHead(404, {
        'Content-type': 'text/html',
      });
      if (err) {
        res.end('<!DOCTYPE html><html lang="en"><head><title>ERROR 404</title></head><body><h1>ERROR 404</h1></body></html>');
        return;
      }
      // Serve the error file to the client
      fs.createReadStream(errorFile).pipe(res);
    });
    // Log about this
    Log.write(Log.DEBUG, 'Chat server could not find requested file');
  }

  /**
  * getContentTypeForPath() is
  * a simple utility function that
  * works out the content type
  * of a file, based on the
  * ending of the file path.
  *
  * @param {string} path
  */
  getContentTypeForPath(path) {
    const typeList = {
      html: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      json: 'application/json',
      png: 'image/png',
      svg: 'image/svg+xml',
      ico: 'image/x-icon',
    };

    // Get the file extention (e.g. js)
    const extention = path.toLowerCase().replace(/^.*\.{1}(?=.+)/, '').replace(/\?.*$/, '');
    // Return the corresponding filetype
    return typeList.hasOwnProperty(extention) ? typeList[extention] : 'text/plain';
  }

}

// Export
module.exports = ChatServer;
