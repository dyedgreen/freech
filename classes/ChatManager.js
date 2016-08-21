'use strict';


// Imports
const engine = require('engine.io');

const Log = require('./Log.js');
const NetworkMessageType = require('./NetworkMessageType.js');
const Chat = require('./Chat.js');

/**
* Chat Manager
*
* Manages the real-time connections to different chats.
* Manages the list of open chats.
*/
class ChatManager {

  constructor() {
    this.server = null;
  }

  /**
  * open() creates a WebSocket
  * server that is attached
  * to a running http server.
  *
  * @param {http.server} httpServer the server to attach to
  */
  open(httpServer) {
    // Attach to the server
    this.server = engine.attach(httpServer);
    // Handle connection events
    this.server.on('connection', (socket) => {
      socket.send('this is a test');
      socket.close();
    });
  }

  /**
  * close() terminates the
  * WebSocket server.
  *
  * @param {function} callback the callback that will fire once the server is closed
  */
  close(callback) {
    this.server.close();
    setImmediate(() => {
      callback();
    });
  }

  /**
  * resolve() passes an
  * http api request to the
  * corresponding function,
  * which then returns a response.
  *
  * @param {string} url the requestet url
  * @param {http.ServerResponse} res the response to write to
  */
  resolve(url, res) {

  }

}

// Export
module.exports = ChatManager;
