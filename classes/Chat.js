'use strict';


// Imports
const Log = require('./Log.js');
const RandString = require('./RandString.js');
const ChatData = require('./ChatData.js');
const User = require('./User.js');
const NetworkMessageType = require('./NetworkMessageType.js');

/**
* Chat
*
* Contains all the data, a chat can contain. The class also
* provides the functions necessary to modify the chat (e.g. add
* users, set users as online / offline).
* The chat class also manages all connections to the chat.
*
* The message data is loaded from the external ChatData source.
*/
class Chat {

  constructor(chatData, destructor) {
    // Get the chat id and name
    this.id = chatData.id;
    this.name = chatData.name;
    // Set up the needed data structure
    this.users = chatData.users;
    this.messageCount = chatData.messageCount;
    this.connections = [];
    // Schedule destructor (to auto-close chat after x-time, if no users are connected)
    this.destructor = { timeout: null, callback: destructor };
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
      User.testHash(this.users[userIndex].token, tokenHash, time) // The supplied token hash was valid
    ) {
      // If this user has an open connection, close it
      if (this.indexOfConnectedUser(userId) !== -1) this.disconnectUser(userId);
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
      // Send the user the chat-specific data (handshake)
      this.pushHandshake(userId);
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
      // Remove the user from the connection list
      this.connections.splice(connectionIndex, 1);
      // If the chat is now empty, destruct it automatically
      if (this.connections.length === 0) {
        // Will scheudle an immediate destruction
        this.scheduleDestructor(0);
        Log.write(Log.DEBUG, 'Chat destructed on disconnect');
        return;
      }
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
        // The user wants to update his status
        case NetworkMessageType.USER.STATUSUPDATE: {
          // Socket message format:
          // { type, status }
          if (dataObject.hasOwnProperty('status') && typeof dataObject.status === 'string') {
            this.pushUserStatus(dataObject.status, userId);
          }
          break;
        }
        default: {
          // Log this event
          Log.write(Log.WARNING, 'Unknown message type');
        }
      }
    } catch (e) {
      console.log(e);
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
    // Get the last messages from the data
    ChatData.messagesGetOld(this.id, count, lastMessageId == '' ? false : lastMessageId, messages => {
      if (messages) {
        // Keep a clean event loop
        setImmediate(() => {
          // Send the messages to the socket
          const socketResponse = {
            type: NetworkMessageType.DATA.MESSAGELIST,
            messages: messages,
            totalMessageCount: this.messageCount,
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
    });
  }

  /**
  * pushNewMessage() sends a
  * message of a given id to
  * all connected users.
  *
  * @param {string} messageId
  */
  pushNewMessage(message) {
    setImmediate(() => {
      // Send the message to all connected users
      try {
        const totalMessageCount = this.messageCount;
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
  * pushUserStatus() sends a
  * new status for a given user
  * to every connected user.
  * Currently this one-way
  * stateless transmition is
  * used for typing indication.
  *
  * @param {string} status
  * @param {string} userId
  */
  pushUserStatus(status, userId) {
    setImmediate(() => {
      // Send the new status to everyone (exept the emitting user, to preserve network bandwith)
      try {
        const socketMessage = {
          type: NetworkMessageType.UPDATE.USERSTATUS,
          userId: userId,
          status,
        };
        const socketMessageString = JSON.stringify(socketMessage);
        this.connections.forEach(conn => {
          if (conn.userId !== userId) {
            setImmediate(() => {
              conn.socket.send(socketMessageString);
            });
          }
        });
      } catch (e) {
        // Log the error
        Log.write(Log.ERROR, 'Could not send new user status to connected users');
      }
    });
    // Log this
    Log.write(Log.DEBUG, 'Pushing new user status to all connected users');
  }

  /**
  * pushHandshake() sends
  * the handshake to the
  * specified user.
  * Currently, the handshake
  * contains the chats name.
  *
  * @param {string} userId
  */
  pushHandshake(userId) {
    setImmediate(() => {
      // Send the handshake to the specified user, may later contain more information
      try {
        const socketMessage = {
          type: NetworkMessageType.UPDATE.HANDSHAKE,
          chatName: this.name,
        };
        const socketMessageString = JSON.stringify(socketMessage);
        // Find the specified user
        const userIndex = this.indexOfConnectedUser(userId);
        if (userIndex !== -1) this.connections[userIndex].socket.send(socketMessageString);
      } catch (e) {
        // Log the error
        Log.write(Log.ERROR, 'Could not send user handshake');
      }
    });
    // Log this
    Log.write(Log.DEBUG, 'Pushing new handshake to user');
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
      User.testHash(this.users[userIndex].token, tokenHash, time)
    ) {
      // The Message seems valid, create it
      const newMessage = {
        id: RandString.short,
        text: messageText.length > 0 ? messageText.substr(0, 2000) : false, // Current message length limit, be sure to warn on client side!
        attachment: messageImage.length > 0 ? 1 : 0, // The attachment type, 0 = none, 1 = image
        userId: userId,
        time: time,
      };
      // Store it
      ChatData.messagesAddMessage(this.id, newMessage, messageImage.length > 0 ? messageImage : false, success => {
        if (success) {
          // Increment the message count
          this.messageCount ++;
          // Catch everone up on this exiting news
          this.pushNewMessage(newMessage);
        }
      });
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
        // Create the user Data
        const newUser = {
          id: userId,
          name: userName.substr(0, 50),
          token: User.generateToken(),
        };
        // Store change to memory
        setImmediate(() => {
          ChatData.chatAddUser(this.id, newUser, success => {
            if (success) {
              // Log about this
              Log.write(Log.DEBUG, 'New user stored with id', userId);
            } else {
              // TODO: Remove user from local runtime here!
              Log.write(Log.ERROR, 'Could not store user with id', userId);
            }
          });
        });
        // Store user locally / on runtime
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
  * the destructor timeout to 30min from
  * now (can not be updated later, but can
  * be skipped by scheuduleing a new desctuctor
  * with a different timeout e.g. 0).
  *
  * Notice that this function has been updated
  * in the new version to only remove the
  * chat from being OPEN (will also be triggered
  * if the last user dissconnects to preverve working
  * memory).
  *
  * Notice that the destruction will NOT take place, if
  * the chat is actively used e.g. there are people
  * connected.
  *
  * @param {number} chatAge
  */
  scheduleDestructor(chatAge = 180000) {
    // Stop the existing timeout (if applicable)
    if (this.destructor.timeout !== null) clearTimeout(this.destructor.timeout);
    // Set a new distructor timeout
    this.destructor.timeout = setTimeout(() => {
      try {
        if (this.connections.length === 0) {
          // Log about this
          Log.write(Log.DEBUG, 'Destructing chat with id', this.id);
          // Call the destructor callback (the destructor is passed the chats id)
          setImmediate(() => {
            this.destructor.callback(this.id);
          });
        } else {
          Log.write(Log.DEBUG, 'Will not destruct chat');
        }
      } catch (e) {
        // This is to prevent chat destruction errors, if the chat was already destructed
      }
    }, chatAge); // 24 h / one day, if standard
    // Log about this
    Log.write(Log.DEBUG, 'Chat destructor scheduled for chat with id', this.id);
  }

  /**
  * THE FOLLOWING FUNCTIONS ARE STATIC AND TO BE USED
  * BY THE CHAT MANAGER TO INVOKE NON-RUNTIME EVENTS
  * LIKE CHAT CREATION.
  */

  /**
  * createNewChat() creates a new
  * chat from scratch, using an
  * optional name.
  * The chat id is handed back
  * using a callback, if successful.
  *
  * @param {string} name
  * @param {function} callback
  */
  static createNewChat(name, callback) {
    // Keed a clean event loop
    setImmediate(() => {
      // Create name and id
      const chatId = RandString.medium;
      const chatName = typeof name === 'string' && name.length > 0 ? name.substr(0, 50) : 'Chat';
      // Create the chat record
      ChatData.chatCreate(chatId, chatName, success => {
        if (success) {
          // Chat creation went smoothly
          callback(chatId);
          Log.write(Log.INFO, 'New chat created');
        } else {
          // Error
          callback(false);
          Log.write(Log.WARNING, 'Chat creation failed');
        }
      });
    });
  }

}

// Export
module.exports = Chat;
