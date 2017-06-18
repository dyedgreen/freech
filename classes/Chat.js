'use strict';


// Imports
const Log = require('./Log.js');
const RandString = require('./RandString.js');
const OpenGraph = require('./OpenGraph.js');
const Mail = require('./Mail.js');
const ChatData = require('./ChatData.js');
const ChatFiles = require('./ChatFiles.js');
const User = require('./User.js');
const NetworkMessageType = require('./NetworkMessageType.js');

// Constants
const uiText = {
  defaultChatName: 'Chat',
  systemMessage: {
    userNew: '{username} joined the chat',
    userInactive: '{username} left the chat',
    userActive: '{username} re-joined the chat',
    notificationSent: 'Notification sent to: {maillist}',
  },
}


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

  constructor(chatId, destructor, callback) {
    // Set the chat id and empty data
    this.id = chatId;
    this.name = '';
    this.users = [];
    this.messageCount = 0;
    this.connections = [];
    this.uploads = [];
    this.destructor = { timeout: null, callback: null };
    // Try to load the chat data from the DB
    ChatData.loadChat(this.id, data => {
      // Test if the data did load
      if (data) {
        // Store the data
        this.name = data.name;
        this.users = data.users;
        this.messageCount = data.messageCount;
        // Schedule destructor (to auto-close chat after x-time, if no users are connected)
        this.destructor.callback = destructor;
        this.scheduleDestructor();
        // Tell the callback, that the chat was created
        setImmediate(() => {
          if (typeof callback === 'function') callback(true);
        });
        // Log about this
        Log.write(Log.INFO, 'Chat opened with id', this.id);
      } else {
        // Tell callback, that chat was not created (the destructor will not be called)
        setImmediate(() => {
          if (typeof callback === 'function') callback(false);
        });
      }
    });
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
      this.users[userIndex].active && // The user is not deactivated
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
      // Update the last seen timestamp
      const userIndex = this.indexOfUser(userId);
      this.users[userIndex].lastSeen = Date.now();
      // Store change to memory
      setImmediate(() => {
        // This db write will fail silently
        ChatData.updateChatUser(this.id, userId, this.users[userIndex], null);
      });
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
    let dataObject = {};
    let messageType = -1;
    try {
      // Get the message
      dataObject = JSON.parse(data);
      messageType = dataObject.hasOwnProperty('type') ? dataObject.type : -1;
    } catch (e) {
      // Log the parsing error
      Log.write(Log.WARNING, 'Could not parse JSON of network message send by', userId);
    }
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
        // { type, count, loadedMessagesCount }
        const count = dataObject.hasOwnProperty('count') && typeof dataObject.count === 'number' ? Math.floor(dataObject.count) : 0;
        const loadedMessagesCount = dataObject.hasOwnProperty('loadedMessagesCount') && typeof dataObject.loadedMessagesCount === 'number' ? Math.floor(dataObject.loadedMessagesCount) : 0;
        this.sendMessages(socket, count, loadedMessagesCount);
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
      // The user wants to send an email notification from a given message
      case NetworkMessageType.USER.EMAILNOTIFICATION: {
        // Socket message format:
        // { type, time, hash, messageId }
        if (
          dataObject.hasOwnProperty('time') &&
          dataObject.hasOwnProperty('hash') &&
          dataObject.hasOwnProperty('messageId')
        ) {
          const time = +dataObject.time;
          const hash = ''.concat(dataObject.hash);
          const messageId = ''.concat(dataObject.messageId);
          this.sendNotification(messageId, socket, userId, time, hash);
        }
        break;
      }
      // The user indends to start a file upload
      case NetworkMessageType.USER.FILE: {
        // Socket message format:
        // { type, time, hash, fileName, fileType, fileSize, messageText }
        if (
          dataObject.hasOwnProperty('time') &&
          dataObject.hasOwnProperty('hash') &&
          dataObject.hasOwnProperty('fileName') &&
          dataObject.hasOwnProperty('fileType') &&
          dataObject.hasOwnProperty('fileSize') &&
          dataObject.hasOwnProperty('messageText')
        ) {
          // Create the file upload request
          const fileName = ''.concat(dataObject.fileName);
          const fileType = ''.concat(dataObject.fileType);
          const fileSize = +dataObject.fileSize;
          const messageText = ''.concat(dataObject.messageText);
          const hash = ''.concat(dataObject.hash);
          const time = +dataObject.time;
          // Send request info to user
          this.acceptFileUpload(socket, fileName, fileType, fileSize, messageText, userId, hash, time);
        }
        break;
      }
      // The user wants to submit a file-upload part
      case NetworkMessageType.USER.FILEPART: {
        // Socket message format:
        // { type, messageId, partIndex, part }
        if (
          dataObject.hasOwnProperty('messageId') &&
          dataObject.hasOwnProperty('partIndex') &&
          dataObject.hasOwnProperty('part')
        ) {
          this.addFilePart(socket, ''.concat(dataObject.messageId), userId, +dataObject.partIndex, ''.concat(dataObject.part));
        }
        break;
      }
      default: {
        // Log this event
        Log.write(Log.WARNING, 'Unknown message type');
      }
    }
    // Log about this (excludes file upload parts)
    if (messageType !== NetworkMessageType.USER.FILEPART) {
      Log.write(Log.DEBUG, 'Proccessing message from userId', userId, data);
    }
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
  * @param {number} loadedMessagesCount
  */
  sendMessages(socket, count, loadedMessagesCount) {
    // Try to load the messages from the db
    ChatData.loadChatMessages(this.id, count, loadedMessagesCount, messages => {
      // Send the messages to the socket
      const socketResponse = {
        type: NetworkMessageType.DATA.MESSAGELIST,
        messages,
        totalMessageCount: this.messageCount,
      };
      try {
        socket.send(JSON.stringify(socketResponse));
      } catch (e) {
        // Tell the log about the error
        Log.write(Log.ERROR, 'Could not send messages to user');
      }
      Log.write(Log.DEBUG, `Sending ${messages.length} messages to a connected user`);
    });
  }

  /**
  * pushNewMessage() sends a
  * given message to
  * all connected users.
  *
  * @param {string} message
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
          active: user.active,
          connected: this.indexOfConnectedUser(user.id) !== -1,
          lastSeen: user.lastSeen,
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
  * sendNotification() takes
  * a message id, validates
  * the user agains the
  * requested message and
  * sends email-notifications
  * to all emails contained in
  * the message.
  *
  * @param {string} messageId
  * @param {socket} socket
  * @param {string} userId
  * @param {number} time
  * @param {string} hash
  */
  sendNotification(messageId, socket, userId, time, hash) {
    // Validate the user
    const userIndex = this.indexOfUser(userId);
    if (userIndex !== -1 && User.testHash(this.users[userIndex].token, hash, time)) {
      // Find the message and the email-addresses it contains
      ChatData.loadChatMessage(this.id, messageId, message => {
        // Create the socket message
        let socketMessage = {
          type: NetworkMessageType.DATA.EMAILNOTIFICATIONSENT,
          notificationCount: 0,
        };
        // If the message exists and has emails, send emails and return a positive feedback
        if (message && message.userId === userId && message.hasOwnProperty('emails')) {
          // Send the emails
          socketMessage.notificationCount = +message.emails.length;
          let emailNotification = new Mail('notification');
          message.emails.forEach(email => {
            // Send the email
            emailNotification.send(email, {
              message: ''.concat(message.text),
              username: this.users[userIndex].name,
              'url-chat-id': this.id,
              'url-unsubscribe-address': email,
            });
          });
          // Add a notice to the chat
          this.addSystemMessage(uiText.systemMessage.notificationSent.replace('{maillist}', message.emails.join(', ')), userId);
        }
        // Send response with the number of send notifications to the socket
        try {
          const socketMessageString = JSON.stringify(socketMessage);
          setImmediate(() => {
            socket.send(socketMessageString);
          });
        } catch (e) {
          // Log the error
          Log.write(Log.ERROR, 'Could not send email notification feedback to user');
        }
      });
    }
    // TODO: Maybe do something usefull here
  }

  /**
  * addSystemMessage() will
  * add a custom system message
  * to the chat. These messages
  * can be used to indicate
  * events on the side of the server.
  *
  * @param {string} messageText (the text of the system message, max 1000 chars)
  * @param {string} userId (the id of the user that caused the event, can be empty)
  */
  addSystemMessage(text, userId) {
    // Validate the inputs
    if (
      typeof text === 'string' &&
      text.length > 0 &&
      (this.indexOfUser(userId) !== -1 || userId === '')
    ) {
      // The Message seems valid, create it
      const newMessage = {
        id: RandString.idMessage,
        userId: userId,
        time: Date.now(),
        systemMessage: ''.concat(text).substr(0, 1000),
      };
      // Store the new message and send it to connected users
      ChatData.addChatMessage(this.id, newMessage, success => {
        // Currently, this fails silently (FIXME)
        if (success) {
          // Increment the message count
          this.messageCount ++;
          // Catch everone up on the exiting news
          this.pushNewMessage(newMessage);
        }
      });
    }
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
  * @param {string} messageText the text of the message, can not be longer than 2000 chars!
  * @param {string} messageImage the message image, max. 2M chars
  * @param {string} userId the id of the sending user
  * @param {string} tokenHash the hashed token
  * @param {number} time the time the message was created (and the token was hashed)
  * @return {bool}
  */
  addMessage(messageText, userId, hash, time) {
    // Validate the inputs
    const userIndex = this.indexOfUser(userId);
    if (
      userIndex !== -1 &&
      typeof messageText === 'string' &&
      messageText.length > 0 && // Message text is present
      User.testHash(this.users[userIndex].token, hash, time)
    ) {
      // The Message seems valid, create it
      let newMessage = {
        id: RandString.idMessage,
        userId: userId,
        time: time,
      };
      // Get the message (max length is 2000)
      newMessage.text = messageText.substr(0, 2000);
      // Test for emails contained in the message (RegEx: http://stackoverflow.com/questions/201323/using-a-regular-expression-to-validate-an-email-address)
      let emails = newMessage.text.match(/(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/ig);
      if (Array.isArray(emails) && emails.length > 0) {
        // Add the emails to the message
        newMessage.emails = emails;
        // Remove the emails from the string that is matched against the url regex
        messageText = messageText.substr(0, 2000);
        emails.forEach(emailString => messageText = messageText.replace(emailString, ''));
      }
      // Test for open graph / twitter card content (this is async, but crawler uses tight timeouts)
      OpenGraph.crawlFromString(messageText, urlPreview => {
        // Add the url preview if available
        if (urlPreview) newMessage.urlPreview = urlPreview;
        // Store the new message and send it to connected users
        ChatData.addChatMessage(this.id, newMessage, success => {
          // Currently, this fails silently (FIXME)
          if (success) {
            // Increment the message count
            this.messageCount ++;
            // Catch everone up on the exiting news
            this.pushNewMessage(newMessage);
          } else {
            // Log this
            Log.write(Log.WARNING, 'Message could not be stored for chat with id', this.id);
          }
        });
      });
      // Success feedback (store attempt made)
      return true;
    }
    // Error, message was malformed
    return false;
  }

  /**
  * addFileUpload() will accept
  * a file-upload request. The
  * request needs to be validated
  * for a given user.
  * There is a limit for the possible
  * file size. (The limit is set in
  * ChatFiles.js).
  *
  * Upload operations are killed, if the
  * chat destructs, before they where finished.
  *
  * @param {socket} socket
  * @param {string} fileName
  * @param {string} fileType
  * @param {number} fileSize
  * @param {string} messageText (max length is 500 chars; shorter than regular messages)
  * @param {string} userId the id of the sending user
  * @param {string} tokenHash the hashed token
  * @param {number} time the time the message was created (and the token was hashed)
  */
  acceptFileUpload(socket, fileName, fileType, fileSize, messageText, userId, hash, time) {
    // Prepare socket response
    let socketMessage = {
      type: NetworkMessageType.DATA.FILEACCEPT,
      accepted: false,
      messageId: '',
    };
    // Validate the user and data
    const userIndex = this.indexOfUser(userId);
    if (
      userIndex !== -1 &&
      typeof fileName === 'string' &&
      typeof fileType === 'string' &&
      typeof fileSize === 'number' &&
      typeof messageText === 'string' &&
      fileSize > 0 &&
      fileSize <= ChatFiles.limits.partCount && // Max file size in n * 2048 UTF-8 encoded chars
      fileName.length > 0 &&
      fileType.length > 0 &&
      User.testHash(this.users[userIndex].token, hash, time)
    ) {
      // Create the upload request
      let upload = {
        messageId: RandString.idMessage,
        userId: userId,
        fileName: fileName.substr(0, 100),
        fileType: fileType.substr(0, 50),
        fileSize,
        messageText: messageText.substr(0, 500),
        current: 0, /*current next part*/
      };
      // Store the upload request
      this.uploads.push(upload);
      // Set socket feedback data
      socketMessage.accepted = true;
      socketMessage.messageId = upload.messageId;
    }
    // Send response with the file upload/messageId or error (false)
    try {
      const socketMessageString = JSON.stringify(socketMessage);
      setImmediate(() => {
        socket.send(socketMessageString);
      });
    } catch (e) {
      // Log the error
      Log.write(Log.ERROR, 'Could not send file upload feedback to user');
    }
  }

  /**
  * addFilePart() will store the part for
  * a file. It will also send a response
  * to the sending socket.
  *
  *@param {socket} socket
  * @param {string} messageId id of upload
  * @param {string} userId user that created the part
  * @param {number} partIndex identifies the part
  * @param {string} part utf-8 encoded data
  */
  addFilePart(socket, messageId, userId, partIndex, part) {
    // Prepare socket response
    let respond = data => {
      let socketMessage = {
        type: NetworkMessageType.DATA.FILEACC,
        nextIndex: data, // can be number / true or false on error on successs
        messageId: ''.concat(messageId),
      };
      // Send response
      try {
        const socketMessageString = JSON.stringify(socketMessage);
        setImmediate(() => {
          socket.send(socketMessageString);
        });
      } catch (e) {
        // Log the error
        Log.write(Log.ERROR, 'Could not send file part feedback to user');
      }
    }
    // Validate the inputs
    const uploadIndex = this.indexOfUpload(messageId);
    if (
      uploadIndex !== -1 &&
      this.uploads[uploadIndex].userId === userId &&
      this.uploads[uploadIndex].current === partIndex &&
      typeof part === 'string' &&
      part.length > 0 &&
      part.length <= ChatFiles.limits.partSize
    ) {
      // Write the part
      ChatFiles.storeFilePart(this.id, messageId, part, success => {
        if (success) {
          // Determine if this was the last part
          this.uploads[uploadIndex].current ++;
          if (this.uploads[uploadIndex].current < this.uploads[uploadIndex].fileSize) {
            // Request next part
            respond(this.uploads[uploadIndex].current);
          } else {
            // This was the last part, finalize the file
            ChatFiles.finalizeFile(this.id, messageId, () => {
              // Get the upload
              const upload = this.uploads[uploadIndex];
              // Create the chat message
              let newMessage = {
                id: messageId,
                userId: userId,
                time: Date.now(),
              };
              // Add the text if present
              if (upload.messageText.length > 0) newMessage.text = upload.messageText;
              // Add the image/file data
              switch (upload.fileType) {
                // Images
                case 'image/png':
                case 'image/jpeg':
                case 'image/gif': {
                  // Images that are displayed get special treatment ;)
                  newMessage.image = {
                    name: upload.fileName,
                    type: upload.fileType,
                  };
                  break;
                }
                // All other files
                default: {
                  newMessage.file = {
                    name: upload.fileName,
                    type: upload.fileType,
                  };
                  break;
                }
              }
              // Store the new message and catch errors
              ChatData.addChatMessage(this.id, newMessage, success => {
                if (success) {
                  // Increment the message count
                  this.messageCount ++;
                  // Destroy the upload
                  this.uploads.splice(uploadIndex, 1);
                  // Send response to socket
                  respond(true);
                  // Catch everone up on the exiting news
                  this.pushNewMessage(newMessage);
                } else {
                  // Log this
                  Log.write(Log.WARNING, 'Message with attachment could not be stored for chat with id', this.id);
                }
              });
            });
          }
        } else {
          // Write error, destroy the upload and remove any temp-files
          this.uploads.splice(uploadIndex, 1);
          ChatFiles.deleteFile(this.id, messageId, () => {
            // Response to socket
            respond(false);
          });
        }
      });
    } else {
      // There was a problem with the inputs
      setImmediate(() => {
        // Destroy file upload (and any parts that might still exist)
        if (uploadIndex !== -1 ) {
          ChatFiles.deleteFile(this.id, this.uploads[uploadIndex].messageId, () => {
            // Remove upload
            this.uploads.splice(uploadIndex, 1);
          });
        }
        // Hit response
        respond(false);
        // Log this
        Log.write(Log.DEBUG, 'Malformed file part request');
      });
    }
  }

  /**
  * addUser() adds a user to
  * the chat and returns his
  * personal access token. Or
  * false in case of error, or
  * false if the user already
  * existed / the user limit
  * has been reached.
  *
  * @param {string} userId
  * @param {string} userName
  * @return {string or bool}
  */
  addUser(userId, userName) {
    const userIndex = this.indexOfUser(userId);
    if (userIndex === -1 && this.users.length < 256) {
      // Test the user id & name
      if (User.validateId(userId) && User.validateName(userName)) {
        // Create the user Data (this data model should not change!)
        const newUser = {
          id: userId,
          name: userName.substr(0, 50),
          token: User.generateToken(),
          active: true,
          lastSeen: Date.now(),
        };
        // Store change to db
        setImmediate(() => {
          ChatData.addChatUser(this.id, newUser, success => {
            if (success) {
              // Add a system message
              this.addSystemMessage(uiText.systemMessage.userNew.replace('{username}', newUser.name), newUser.id);
              // Log about this
              Log.write(Log.DEBUG, 'New user stored with id', userId);
            } else {
              // Disconnect the user
              this.disconnectUser(userId);
              // Remove the user and update the user list
              this.users.splice(this.indexOfUser(userId), 1);
              // Update everyones user list
              this.pushUserList();
              // Log this
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
      // User already exists or limit is reached, can't be added
      return false;
    }
  }

  /**
  * changeUserActive() allows
  * to activate and deactivate
  * a given user. This status is
  * shared with all users in the
  * chat.
  * A user who is deactivated can
  * not join the chat.
  * Returns whether the supplied
  * data was correct.
  *
  * @param {string} userId
  * @param {string} hash
  * @param {bool} isActive
  * @return {bool}
  */
  changeUserActive(userId, tokenHash, time, isActive) {
    // Validate the userId and hash
    const userIndex = this.indexOfUser(userId);
    if (
      userIndex !== -1 &&
      User.testHash(this.users[userIndex].token, tokenHash, time)
    ) {
      // Update the users local status
      this.users[userIndex].active = !!isActive;
      // Store change to memory
      setImmediate(() => {
        // This db write will fail silently
        ChatData.updateChatUser(this.id, userId, this.users[userIndex], success => {
          // If the status is reflected in the db, write a system message
          if (success) {
            const text = this.users[userIndex].active ? uiText.systemMessage.userActive : uiText.systemMessage.userInactive;
            this.addSystemMessage(text.replace('{username}', this.users[userIndex].name), userId);
          }
        });
      });
      // Push a new user list to all connected clients
      this.pushUserList();
      // Return success
      return true;
    } else {
      // The inputs where invalid
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
  * indexOfUpload() returns the index
  * of a given upload in the upload list.
  * The upload is identified by it's
  * assigned message id.
  *
  * @param {string} messageId
  * @return {number}
  */
  indexOfUpload(messageId) {
    // Try to find the requested message
    for (let i = 0; i < this.uploads.length; i ++) {
      if (this.uploads[i].messageId === messageId) return i;
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
    // Test if destructor is given
    if (typeof this.destructor.callback === 'function') {
      // Set a new distructor timeout
      this.destructor.timeout = setTimeout(() => {
        try {
          if (this.connections.length === 0) {
            // Log about this
            Log.write(Log.DEBUG, 'Destructing chat with id', this.id);
            // Destroy all open file uploads
            this.uploads.forEach(fileUpload => {
              ChatFiles.deleteFile(this.id, fileUpload.messageId, null);
            });
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
      }, chatAge); // 3 min, if standard
      // Log about this
      Log.write(Log.DEBUG, 'Chat destructor scheduled for chat with id', this.id);
    }
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
      const chatId = RandString.idChat;
      const chatName = typeof name === 'string' && name.length > 0 ? name.substr(0, 50) : uiText.defaultChatName;
      // Create the new chats data
      const chat = {
        id: chatId,
        name: chatName,
        messageCount: 0,
        users: [],
        messages: [],
      };
      // Store the chat
      ChatData.addChat(chatId, chat, success => {
        if (success) {
          // Chat creation did work
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
