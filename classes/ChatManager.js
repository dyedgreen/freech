'use strict';


// Imports
const engine = require('engine.io');

const Log = require('./Log.js');
const RandString = require('./RandString.js');
const ApiResponse = require('./ApiResponse.js');
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
    // Keep track of the server
    this.server = null;
    // Keep track of all created chats
    this.chats = [];
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
    this.server.on('connection', socket => {
      socket.once('message', data => {
        this.handleChatHandshake(socket, data);
      });
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
  * @param {Url} url the requestet url
  * @param {http.ServerResponse} res the response to write to
  */
  resolve(url, res) {
    // Test if the request targets the chats endpoint (/api/chats/something)
    if (url.path.length > 2 && url.path[1] == 'chat') {
      switch (url.path[2]) {
        case 'new': {
          // Make a new chat
          const chatId = this.createChat();
          // Send the chat id to the client
          ApiResponse.sendData(res, chatId, false);
          return;
          break;
        }
        case 'join': {
          // Get the users id & name
          if (
            url.data.hasOwnProperty('chatId') && this.indexOfChat(url.data.chatId) !== -1 &&
            url.data.hasOwnProperty('userId') &&
            url.data.hasOwnProperty('userName')
          ) {
            const chatId = decodeURI(''.concat(url.data.chatId));
            const userId = decodeURI(''.concat(url.data.userId));
            const userName = decodeURI(''.concat(url.data.userName));
            const userToken = this.chats[this.indexOfChat(chatId)].addUser(userId, userName);
            // Send the user token back to the request
            ApiResponse.sendData(res, userToken, !userToken);
            return;
          }
          break;
        }
      }
    }
    // General error response
    ApiResponse.sendData(res, null, true);
    // Log this shit
    Log.write(Log.DEBUG, 'Trying to resolve api request');
  }

  /**
  * handleChatHandshake() lets
  * a socket join a chat as a
  * user of closes it.
  *
  * @param {socket} socket
  * @param {string} message
  */
  handleChatHandshake(socket, message) {
    // Get the data from the message
    try {
      const messageObj = JSON.parse(message);
      if (
        messageObj.hasOwnProperty('type') && messageObj.type == NetworkMessageType.USER.HANDSHAKE &&
        messageObj.hasOwnProperty('chatId') &&
        messageObj.hasOwnProperty('userId') &&
        messageObj.hasOwnProperty('hash') &&
        messageObj.hasOwnProperty('time')
      ) {
        // Try to find the chat
        const chatIndex = this.indexOfChat(messageObj.chatId);
        if (chatIndex !== -1) {
          // Connect to the chat
          this.chats[chatIndex].connectUser(socket, messageObj.userId, messageObj.hash, messageObj.time);
          return;
        }
      }
    } catch (e) {
      // Something went downhill; TODO: Log this!
    }
    // General error handling (aborted by return on success)
    socket.close();
  }

  /**
  * createChat() creates a new
  * chat and adds it to the
  * chat list, managed by this
  * instance.
  * It returns the chats id.
  *
  * @return {string}
  */
  createChat() {
    // Create the chat
    const newChat = new Chat(this.destructChat);
    this.chats.push(newChat);
    return newChat.id;
  }

  /**
  * destructChat() is the destructor
  * function that is passed to each
  * chat instance to clean itself
  * up, once it expires.
  *
  * @param {string} chatId
  */
  destructChat(chatId) {
    const chatIndex = this.indexOfChat(chatId);
    if (chatIndex !== -1) {
      // Delete the chat
      this.chats.splice(chatIndex, 1);
    }
  }

  /**
  * indexOfChat() returns
  * the index of a given
  * chat id in the chats
  * array.
  *
  * @param {string} chatId
  * @return {number}
  */
  indexOfChat(chatId) {
    // Try to find the requested chat
    for (let i = 0; i < this.chats.length; i ++) {
      if (this.chats[i].id === chatId) return i;
    }
    return -1;
  }

}

// Export
module.exports = ChatManager;
