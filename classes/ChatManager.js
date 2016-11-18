'use strict';


// Imports
const engine = require('engine.io');

const Log = require('./Log.js');
const RandString = require('./RandString.js');
const ApiResponse = require('./ApiResponse.js');
const NetworkMessageType = require('./NetworkMessageType.js');
const ChatData = require('./ChatData.js');
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
    // Keep track of all currently open chats
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
    this.server = engine.attach(httpServer, {
      // Set the ping/pong timeout to 20 seconds
      pingTimeout: 20000,
    });
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
    // Test if the request targets the chats endpoint (/api/chats/something ...)
    if (url.path.length > 2 && url.path[1] == 'chat') {
      switch (url.path[2]) {
        case 'new': {
          // Get the name
          const name = url.data.hasOwnProperty('chatName') ? decodeURI(url.data.chatName) : null;
          // Make a new chat
          Chat.createNewChat(name, chatId => {
            // Send the chat id to the client (if this function fails, it will automatically return false)
            ApiResponse.sendData(res, chatId, false);
          });
          return;
          break;
        }
        case 'join': {
          // Get the users id & name
          if (
            url.data.hasOwnProperty('chatId') &&
            url.data.hasOwnProperty('userId') &&
            url.data.hasOwnProperty('userName')
          ) {
            // Get the data
            const chatId = decodeURI(''.concat(url.data.chatId));
            const userId = decodeURI(''.concat(url.data.userId));
            const userName = decodeURI(''.concat(url.data.userName));
            // Get the chat / open it if its not allready open
            const chatIndex = this.indexOfOpenChat(chatId);
            if (chatIndex === -1) {
              // Open the chat
              this.openChat(chatId, success => {
                // If the chat was opened, try to join, else abort
                if (success) {
                  // Join the chat
                  const userToken = this.chats[this.indexOfOpenChat(chatId)].addUser(userId, userName);
                  // Send the user token back to the request
                  ApiResponse.sendData(res, userToken, !userToken);
                } else {
                  // Error response, could not be opened
                  ApiResponse.sendData(res, null, true);
                }
              });
            } else {
              // Join the chat
              const userToken = this.chats[chatIndex].addUser(userId, userName);
              // Send the user token back to the request
              ApiResponse.sendData(res, userToken, !userToken);
            }
            return;
          }
          break;
        }
        case 'attachment': {
          // Serve a chat attachment (image) format: api/chat/attachment/image/chatId/messageId
          if (url.path.length == 6 && url.path[3] == 'image') {
            // Try to fetch the image and send it to the request
            ChatData.attachmentsPipeImage(url.path[4], url.path[5], res);
            return;
          }
          break;
        }
      }
    }
    // General error response
    ApiResponse.sendData(res, null, true);
    // Log this shit
    Log.write(Log.WARNING, 'Trying to resolve api request failed');
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
        const chatIndex = this.indexOfOpenChat(messageObj.chatId);
        if (chatIndex !== -1) {
          // Connect to the chat
          this.chats[chatIndex].connectUser(socket, messageObj.userId, messageObj.hash, messageObj.time);
        } else {
          // Try to open the chat and connect to the chat after it was opened
          this.openChat(messageObj.chatId, success => {
            if (success) {
              // Connect to the chat
              this.chats[this.indexOfOpenChat(messageObj.chatId)].connectUser(socket, messageObj.userId, messageObj.hash, messageObj.time);
            } else {
              // Close the socket
              socket.close();
            }
          });
        }
      } else {
        // Close the socket
        socket.close();
      }
    } catch (e) {
      // Something went downhill; TODO: Log this!
    }
  }

  /**
  * openChat() is the creator
  * function, that instantiates a
  * chat in the memory. It will also
  * scheudule an automatic destruction.
  *
  * @param {string} chatId
  * @param {function} callback
  */
  openChat(chatId, callback) {
    // Load the chat from memory
    ChatData.chatGetData(chatId, data => {
      if (data) {
        // Create the chat and add it to the chat list
        this.chats.push(new Chat(data, chatId => {
          this.closeChat(chatId);
        }));
        callback(true);
      } else {
        // The chat loading failed
        callback(false);
      }
    });
  }

  /**
  * closeChat() is the destructor
  * function that is passed to each
  * chat instance to clean itself
  * up, once everyone disconnects.
  *
  * @param {string} chatId
  */
  closeChat(chatId) {
    const chatIndex = this.indexOfOpenChat(chatId);
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
  indexOfOpenChat(chatId) {
    // Try to find the requested chat
    for (let i = 0; i < this.chats.length; i ++) {
      if (this.chats[i].id === chatId) return i;
    }
    return -1;
  }

}

// Export
module.exports = ChatManager;
