'use strict';


const Log = require('./Log.js');
const RandString = require('./RandString.js');
const User = require('./User.js');

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
    // Last time something changed / was added / was updated
    this.lastChangeTime = {
      messages: Date.now(),
      users: Date.now(),
      connection: Date.now(),
    };
    // Schedule destructor
    this.destructor = { timeout: null, callback: destructor };
    this.rescheduleDestructor();
    // Log about this
    Log.write(Log.INFO, 'Chat created with id', this.id);
  }

  connectUser(socket, ) {

  }

  dissconnectUser() {

  }

  /**
  * syncState() relays all
  * new messages to the connected
  * users and updates their
  * user-lists if needed.
  */
  syncState() {
    // Keep the event loop clean
    setImmediate(() => {

    });
  }

  /**
  * syncConnectedUser() relays all new
  * messages to a given and
  * connected user. This should not be
  * called.
  *
  * @param {connection} connection
  */
  syncConnectedUser(connection) {

  }

  /**
  * addMessage() adds a new
  * message to the chat. The user
  * needs to identify himself, using
  * his (hashed)tooken and his id.
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
      this.messages.push({
        id: RandString.short,
        text: messageText,
        userId: userId,
        time: time,
      });
      // Update last change time
      this.lastChangeTime.messages = Date.now();
      // Catch everone up on this exiting news
      this.syncState();
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
        this.users.push(new User);
        // Update last change time
        this.lastChangeTime.users = Date.now();
        // Return the token
        return newUser.token;
      } else {
        // Invalid ID
        return false;
      }
    } else {
      // User already exists
      return true;
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
    for (i = 0; i < this.users.length; i ++) {
      if (this.users[i].id === userId) return i;
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
      // Call the destructor callback
      this.destructor.callback();
    }, 86400000); // 24 h / one day
    // Log about this
    Log.write(Log.DEBUG, 'Chat destructor rescheduled for chat with id', this.id);
  }

}

// Export
module.exports = Chat;
