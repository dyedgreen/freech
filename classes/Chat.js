'use strict';


// Imports
const Log = require('./Log.js');
const RandString = require('./RandString.js');
const User = require('./User.js');
const NetworkMessageType = require('./NetworkMessageType.js');

/**
* Chat
*
* Contains all the data, a chat can contain. The class also
* provides the functions necessary to modify the chat (e.g. add
* users, set users as online / offline).
* The chat class also manages all connections to the chat.
*/
class Chat {

  constructor(destructor) {
    // Create the chat id
    this.id = RandString.long;
    // Set up the needed data structure
    this.users = [];
    this.messages = [];
    this.connections = [];
    // Schedule destructor
    this.destructor = { time: null, callback: destructor };
    this.scheduleDestructor();
    // Log about this
    Log.write(Log.INFO, 'Chat created with id', this.id);
  }

  /**
  * connectUser() connects a
  * user to the chat, if he
  * supplies a valid hash and
  * is not already connected.
  *
  * @param {socket} socket
  * @param {string} userId
  * @param {string} tokenHash
  * @param {number} time
  */
  connectUser(socket, userId, tokenHash, time) {
    // Get the users index
    const userIndex = this.indexOfUser(userId);
    // Test if the user is valid
    if (
      userIndex !== -1 && // User is registered
      this.indexOfConnectedUser(userId) === -1 && // User is not already connected FIXME: Timeout on 'real' server could cause reconnection problems
      this.users[userIndex].testHash(tokenHash, time) // The supplied token hash was valid
    ) {
      // Add this to the connections
      this.connections.push({
        userId,
        socket,
      });
      // Add message event handler to the socket
      socket.on('message', data => {
        this.proccessSocketMessage(userId, socket, data);
      });
      socket.on('close', () => {
        this.disconnectUser(userId);
      });
      // Update everyones user list
      this.pushUserList();
      // Send the user the current chat expiration time (will probably not change, but might in a future update)
      this.sendChatExpirationTime(socket);
      // Log about the event
      Log.write(Log.INFO, 'User connected with id', userId);
    } else {
      console.log(userIndex, this.indexOfConnectedUser(userId), this.users[userIndex].testHash(tokenHash, time));
      setImmediate(() => {
        // Close the socket
        socket.close();
        // Log about the event
        Log.write(Log.INFO, 'Invalid user with id', userId);
      });
    }
  }

  /**
  * disconnectUser() removes
  * a connected user from the
  * connection list, after closing
  * its socket.
  *
  * @param {string} userId
  */
  disconnectUser(userId) {
    const connectionIndex = this.indexOfConnectedUser(userId);
    if (connectionIndex !== -1) {
      // Close the socket
      this.connections[connectionIndex].socket.close();
      setImmediate(() => {
        // Remove the user from the connection list
        this.connections.splice(connectionIndex, 1);
      });
      // Update everyones user list
      this.pushUserList();
      // Log about the event
      Log.write(Log.INFO, 'User disconncted with id', userId);
    }
  }

  /**
  * proccessSocketMessage() proccesses
  * a message, recived from a connected
  * (and hence validated) socket.
  * The messages are relayed to the
  * corresponding functions.
  *
  * @param {string} userId
  * @param {socket} socket
  */
  proccessSocketMessage(userId, socket, data) {
    // Try to decode the json data
    try {
      // Get the message
      const dataObject = JSON.parse(data);
      const messageType = dataObject.hasOwnProperty('type') ? dataObject.type : -1;

      // Proccess the message correctly
      switch (messageType) {
        // The user wants to send a new message
        case NetworkMessageType.USER.MESSAGE: {
          // Socket message format:
          // { type, time, hash, messageText, messageImage }
          if (
            dataObject.hasOwnProperty('time') &&
            dataObject.hasOwnProperty('hash') &&
            dataObject.hasOwnProperty('messageText') &&
            dataObject.hasOwnProperty('messageImage')
          ) {
            this.addMessage(dataObject.messageText, dataObject.messageImage, userId, dataObject.hash, dataObject.time);
          }
          break;
        }
        // The user wants to load existing messages
        case NetworkMessageType.USER.LOADMESSAGES: {
          // Socket message format:
          // { type, count, lastMessageId }
          const count = dataObject.hasOwnProperty('count') && typeof dataObject.count === 'number' ? Math.floor(dataObject.count) : 0;
          const lastMessageId = dataObject.hasOwnProperty('lastMessageId') && typeof dataObject.lastMessageId === 'string' ? dataObject.lastMessageId : false;
          this.sendMessages(socket, count, lastMessageId);
          break;
        }
        default: {
          // Log this event
          Log.write(Log.INFO, 'Unknown message type');
        }
      }
    } catch (e) {
      Log.write(Log.WARNING, 'Could not parse JSON of network message send by', userId);
    }
    // Log about this
    Log.write(Log.DEBUG, 'Proccessing message from userId', userId, data);
  }

  /**
  * sendMessages() sends an excerpt
  * of the messaes list to a given
  * socket. The socket is assumed to
  * be a connected user.
  * The messages are send beginning with
  * offset for count messages. They appear
  * in the same order as in the original
  * list.
  *
  * @param {socket} socket
  * @param {number} count
  * @param {number} offset
  */
  sendMessages(socket, count, lastMessageId) {
    // Get the last message index (will be excluded)
    let lastMessageIndex = this.indexOfMessage(lastMessageId);
    if (lastMessageIndex === -1) lastMessageIndex = this.messages.length;
    // Count back to the wanted index
    let startMessageIndex = count > lastMessageIndex ? 0 : lastMessageIndex - count;
    // Find the messages in the message data if some where requested
    if (startMessageIndex < lastMessageIndex) {
      // Keep a clean event loop
      setImmediate(() => {
        // Get the messages
        const messages = this.messages.slice(startMessageIndex, lastMessageIndex);
        const totalMessageCount = this.messages.length;
        // Send the messages to the socket
        const socketResponse = {
          type: NetworkMessageType.DATA.MESSAGELIST,
          messages,
          totalMessageCount,
        };
        try {
          socket.send(JSON.stringify(socketResponse));
        } catch (e) {
          // Tell the log about the error
          Log.write(Log.ERROR, 'Could not send messages to user');
        }
      });
      Log.write(Log.DEBUG, `Sending ${count} messages to a connected user`);
    }
  }

  /**
  * sendChatExpirationTime()
  * forwards the current
  * chat expiration time
  * to a given socket.
  *
  * @param {socket} socket
  */
  sendChatExpirationTime(socket) {
    // Keep a clean event loop
    setImmediate(() => {
      // Build the message
      const socketMessage = {
        type: NetworkMessageType.UPDATE.CHATEXPIRATION,
        expirationTime: this.destructor.time,
      };
      // Send the message to the user
      try {
        socket.send(JSON.stringify(socketMessage));
      } catch (e) {
        // There was a problem
        Log.write(Log.ERROR, 'Could not send chat expiration time to user');
      }
    });
  }

  /**
  * pushNewMessage() sends a
  * message of a given id to
  * all connected users.
  *
  * @param {string} messageId
  */
  pushNewMessage(messageId) {
    setImmediate(() => {
      // Find the message
      const messageIndex = this.indexOfMessage(messageId);
      if (messageIndex !== -1) {
        // Send the message to all connected users
        try {
          const message = this.messages[messageIndex];
          const totalMessageCount = this.messages.length;
          const socketMessage = {
            type: NetworkMessageType.UPDATE.NEWMESSAGE,
            message,
            totalMessageCount,
          };
          const socketMessageString = JSON.stringify(socketMessage);

          this.connections.forEach(conn => {
            // Send the messages, by registering each send in the event loop
            setImmediate(() => {
              conn.socket.send(socketMessageString);
            });
          });
        } catch (e) {
          // Tell the log about the error
          Log.write(Log.ERROR, 'Could not send new message to connected users');
        }
      }
    });
    // Log about this event
    Log.write(Log.DEBUG, 'Pushing new message to all connected users');
  }

  /**
  * pushUserList() builds and
  * sends the current list of
  * all users to all connected
  * clients.
  */
  pushUserList() {
    setImmediate(() => {
      // Build the user list
      let userList = [];
      this.users.forEach(user => {
        userList.push({
          id: user.id,
          name: user.name,
          connected: this.indexOfConnectedUser(user.id) !== -1,
        });
      });

      // Send the list to everyone
      try {
        const socketMessage = {
          type: NetworkMessageType.UPDATE.USERLIST,
          userList,
        };
        const socketMessageString = JSON.stringify(socketMessage);
        this.connections.forEach(conn => {
          setImmediate(() => {
            conn.socket.send(socketMessageString);
          });
        });
      } catch (e) {
        // Log the error
        Log.write(Log.ERROR, 'Could not send new user list to connected users');
      }
    });
    // Log this
    Log.write(Log.DEBUG, 'Pushing new user list to all connected users');
  }

  /**
  * addMessage() adds a new
  * message to the chat. The user
  * needs to identify himself, using
  * his (hashed) tooken and his id.
  * Returns if the message was added
  * or not.
  *
  * Input limitations are validated on
  * the client side and notified there,
  * the server silentely drops / corrects
  * them.
  *
  * @param {string} messageText the text of the message, can not be longer than 1000 chars!
  * @param {string} userId the id of the sending user
  * @param {string} tokenHash the hashed token
  * @param {number} time the time the message was created (and the token was hashed)
  * @return {bool}
  */
  addMessage(messageText, messageImage, userId, tokenHash, time) {
    // Validate the inputs
    const userIndex = this.indexOfUser(userId);
    if (
      userIndex !== -1 &&
      typeof messageText === 'string' &&
      typeof messageImage === 'string' &&
      messageText.length + messageImage.length > 0 && // Either an image or a text or both
      messageImage.length <= 1000000 && // Max image size (images are downscaled on client side)
      this.users[userIndex].testHash(tokenHash, time)
    ) {
      // The Message seems valid, add it
      const id = RandString.short;
      this.messages.push({
        id,
        text: messageText.length > 0 ? messageText.substr(0, 2000) : false, // Current message length limit, be sure to warn on client side!
        image: messageImage.length > 0 ? messageImage : false,
        userId: userId,
        time: time,
      });
      // Catch everone up on this exiting news
      this.pushNewMessage(id);
      // Return true
      return true;
    }
    return false;
  }

  /**
  * addUser() adds a user to
  * the chat and returns his
  * personal access token. Or
  * false in case of error, or
  * true if the user already
  * existed.
  *
  * @param {string} userId
  * @param {string} userName
  * @return {string or bool}
  */
  addUser(userId, userName) {
    const userIndex = this.indexOfUser(userId);
    if (userIndex === -1) {
      // Test the user id & name
      if (User.validateId(userId) && User.validateName(userName)) {
        // Add the user
        const newUser = new User(userId, userName);
        this.users.push(newUser);
        // Update everyones user list
        this.pushUserList();
        // Log about this
        Log.write(Log.INFO, 'New user added with id', userId);
        // Return the token
        return newUser.token;
      } else {
        // Invalid ID
        return false;
      }
    } else {
      // User already exists, can't be added
      return false;
    }
  }

  /**
  * indexOfUser() returns the index
  * of a given user in the user list.
  *
  * @param {string} userId
  * @return {number}
  */
  indexOfUser(userId) {
    // Try to find the requested user
    for (let i = 0; i < this.users.length; i ++) {
      if (this.users[i].id === userId) return i;
    }
    return -1;
  }

  /**
  * indexOfConnectedUser() returns the index
  * of a given user in the connections list.
  *
  * @param {string} userId
  * @return {number}
  */
  indexOfConnectedUser(userId) {
    // Try to find the requested user
    for (let i = 0; i < this.connections.length; i ++) {
      if (this.connections[i].userId === userId) return i;
    }
    return -1;
  }

  /**
  * indexOfMessage() returns the index
  * of a given message in the messages
  * list.
  *
  * @param {string} messageId
  * @return {number}
  */
  indexOfMessage(messageId) {
    // Try to find the requested message
    for (let i = 0; i < this.messages.length; i ++) {
      if (this.messages[i].id === messageId) return i;
    }
    return -1;
  }

  /**
  * rescheduleDestructor() sets
  * the destructor timeout to 24h from
  * now (can not be updated later!).
  *
  * @param {number} chatAge
  */
  scheduleDestructor(chatAge = 86400000) {
    // Set a new distructor timeout
    setTimeout(() => {
      // Log about this
      Log.write(Log.DEBUG, 'Destructing chat with id', this.id);
      // Disconnect all clients
      this.connections.forEach(conn => {
        this.disconnectUser(conn.userId);
      });
      // Call the destructor callback (the destructor is passed the chats id)
      setImmediate(() => {
        this.destructor.callback(this.id);
      });
    }, chatAge); // 24 h / one day, if standard
    // Store the time at which it will happen
    this.destructor.time = Date.now() + chatAge;
    // Log about this
    Log.write(Log.DEBUG, 'Chat destructor scheduled for chat with id / time:', this.id, '/', this.destructor.time);
  }

}

// Export
module.exports = Chat;
