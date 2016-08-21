'use strict';


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
    this.destructor = { timeout: null, callback: destructor };
    this.rescheduleDestructor();
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
      this.indexOfConnectedUser(userId) === -1 && // User is not already connected
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
      // Postpone the destructor timeout
      this.rescheduleDestructor();
      // Log about the event
      Log.write(Log.INFO, 'User connected with id', userId);
    } else {
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
      // Postpone the destructor timeout
      this.rescheduleDestructor();
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
          // { type, time, hash, messageText }
          if (
            dataObject.hasOwnProperty('time') &&
            dataObject.hasOwnProperty('hash') &&
            dataObject.hasOwnProperty('messageText')
          ) {
            this.addMessage(dataObject.messageText, userId, dataObject.hash, dataObject.time);
          }
          break;
        }
        // The user wants to load existing messages
        case NetworkMessageType.USER.LOADMESSAGES: {
          // Socket message format:
          // { type, count, offset }
          const count = dataObject.hasOwnProperty('count') && typeof dataObject.count === 'number' ? Math.floor(dataObject.count) : 0;
          const offset = dataObject.hasOwnProperty('offset') && typeof dataObject.offset === 'number' ? Math.floor(dataObject.offset) : this.messages.length - 1;
          this.sendMessages(socket, count, offset);
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
  sendMessages(socket, count, offset) {
    // Validate the count and the offset
    count = count > 0 ? count : 0;
    offset = offset < this.messages.length && offset > 0 ? offset :0;
    // Find the messages in the message data if some where requested
    if (count > 0) {
      // Keep a clean event loop
      setImmediate(() => {
        // Get the messages
        const messages = this.messages.slice(1 + offset - count, offset + 1);
        // Send the messages to the socket
        const socketResponse = {
          type: NetworkMessageType.DATA.MESSAGELIST,
          messages,
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

  pushNewMessage(messageId) {
    setImmediate(() => {
      // Find the message
      const messageIndex = this.indexOfMessage(messageId);
      if (messageIndex !== -1) {
        // Send the message to all connected users
        try {
          const message = this.messages[messageIndex];
          const socketMessage = {
            type: NetworkMessageType.UPDATE.NEWMESSAGE,
            message,
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
          users: userList,
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
  addMessage(messageText, userId, tokenHash, time) {
    // Validate the inputs
    const userIndex = this.indexOfUser(userId);
    if (
      userIndex !== -1 &&
      typeof messageText === 'string' &&
      messageText.length > 0 &&
      this.users[userIndex].testHash(tokenHash, time)
    ) {
      // The Message seems valid, add it
      const id = RandString.short;
      this.messages.push({
        id,
        text: messageText,
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
      // Test the user id
      if (User.validateId(userId)) {
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
  * rescheduleDestructor() postpones
  * the destructor timeout to 24h from
  * now.
  */
  rescheduleDestructor() {
    // Clear the existing timeout
    clearTimeout(this.destructor.timeout);
    // Set a new timeout
    this.destructor.timeout = setTimeout(() => {
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
    }, 86400000); // 24 h / one day
    // Log about this
    Log.write(Log.DEBUG, 'Chat destructor rescheduled for chat with id', this.id);
  }

}

// Export
module.exports = Chat;
