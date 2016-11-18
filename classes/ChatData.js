'use strict';


// Imports
const Db = require('./Db.js');
const Log = require('./Log.js');

// The self-contained data store and store mode
let storeMode = 0;
let localDataStore = {
  chats: {},
  messages: {},
  attachments: {},
};

/**
* ChatData
*
* This is the chat data abstraction interface. It sits between the
* ChatManager and Chat interfaces, which handle the client <-> chat
* interactions, and the chat data store. By doing this, the ChatData
* class allows the Freech Instance to use different modes of data
* storage (e.g.) SelfContained within the proccess memory or in a DB.
*
* Chats that are currently actively used are held (w. meta data) in the
* chat manager class. The chat messages and inactive chats are only stored
* in the respective interface choosen.
*
* Note that the ChatData class DOES NOT take care of the data validation!
*
* Chat Data:
* chatId -> id, messageCount, users, name
*
* Messages Data:
* chatId -> [ id, attachment(0:none, 1:image, ...), text, time, userId ]
*
* Attachments:
* chatId -> { id(is the id of the message) } -> data
*
* TODO: Add logging !
*/
class ChatData {

  /**
  * Functions to retrive
  * data. These functions
  * will connect to the
  * appropriate store.
  */

  static chatExists(chatId, callback) {
    switch(storeMode) {
      case ChatData.SELFCONTAINED: {
        ChatData.selfContainedChatExists(chatId, callback);
        break;
      }
      case ChatData.MONGODB: {
        // TODO
        break;
      }
      default: {
        // Selfcontained is the standard
        ChatData.selfContainedChatExists(chatId, callback);
      }
    }
  }

  static chatGetData(chatId, callback) {
    switch(storeMode) {
      case ChatData.SELFCONTAINED: {
        ChatData.selfContainedChatGetData(chatId, callback);
        break;
      }
      case ChatData.MONGODB: {
        // TODO
        break;
      }
      default: {
        // Selfcontained is the standard
        ChatData.selfContainedChatGetData(chatId, callback);
      }
    }
  }

  static chatCreate(chatId, name, callback) {
    switch(storeMode) {
      case ChatData.SELFCONTAINED: {
        ChatData.selfContainedChatCreate(chatId, name, callback);
        break;
      }
      case ChatData.MONGODB: {
        // TODO
        break;
      }
      default: {
        // Selfcontained is the standard
        ChatData.selfContainedChatCreate(chatId, name, callback);
      }
    }
  }

  static chatDelete(chatId, callback) {
    switch(storeMode) {
      case ChatData.SELFCONTAINED: {
        ChatData.selfContainedChatDelete(chatId, callback);
        break;
      }
      case ChatData.MONGODB: {
        // TODO
        break;
      }
      default: {
        // Selfcontained is the standard
        ChatData.selfContainedChatDelete(chatId, callback);
      }
    }
  }

  static chatAddUser(chatId, userData, callback) {
    switch(storeMode) {
      case ChatData.SELFCONTAINED: {
        ChatData.selfContainedChatAddUser(chatId, userData, callback);
        break;
      }
      case ChatData.MONGODB: {
        // TODO
        break;
      }
      default: {
        // Selfcontained is the standard
        ChatData.selfContainedChatAddUser(chatId, userData, callback);
      }
    }
  }

  static messagesAddMessage(chatId, messageData, messageAttachment, callback) {
    switch(storeMode) {
      case ChatData.SELFCONTAINED: {
        ChatData.selfContainedMessagesAddMessage(chatId, messageData, messageAttachment, callback);
        break;
      }
      case ChatData.MONGODB: {
        // TODO
        break;
      }
      default: {
        // Selfcontained is the standard
        ChatData.selfContainedMessagesAddMessage(chatId, messageData, messageAttachment, callback);
      }
    }
  }

  static messagesGetOld(chatId, count, lastMessageId, callback) {
    switch(storeMode) {
      case ChatData.SELFCONTAINED: {
        ChatData.selfContainedMessagesGetOld(chatId, count, lastMessageId, callback);
        break;
      }
      case ChatData.MONGODB: {
        // TODO
        break;
      }
      default: {
        // Selfcontained is the standard
        ChatData.selfContainedMessagesGetOld(chatId, count, lastMessageId, callback);
      }
    }
  }

  static attachmentsPipeImage(chatId, messageId, writeStream) {
    switch(storeMode) {
      case ChatData.SELFCONTAINED: {
        ChatData.selfContainedAttachmentsPipeImage(chatId, messageId, writeStream);
        break;
      }
      case ChatData.MONGODB: {
        // TODO
        break;
      }
      default: {
        // Selfcontained is the standard
        ChatData.selfContainedAttachmentsPipeImage(chatId, messageId, writeStream);
      }
    }
  }

  /**
  * Functions that perform
  * the respective storage
  * operations for the mode:
  * SELFCONTAINED
  */

  // Test whether the chat exists (not really needed)
  static selfContainedChatExists(chatId, callback) {
    // Try to find the chat in the local chat list
    if (localDataStore.chats.hasOwnProperty(chatId)) {
      callback(true);
    } else {
      callback(false);
    }
  }

  // Return the chat data to a callback (can also emulate the chat-exists function)
  static selfContainedChatGetData(chatId, callback) {
    // Try to find the chat in the local list and return data if successfull
    if (localDataStore.chats.hasOwnProperty(chatId)) {
      callback(localDataStore.chats[chatId]);
    } else {
      // Chat not found
      callback(false);
    }
  }

  // Store the data for a new chat / create it's data set
  static selfContainedChatCreate(chatId, name, callback) {
    // Test if chat already exists (and stop creatin if it does)
    if (!localDataStore.chats.hasOwnProperty(chatId)) {
      // Set up the data obj
      const chatData = {
        id: chatId,
        name,
        messageCount: 0,
        users: [],
      };
      // Push them to the data store
      localDataStore.chats[chatId] = chatData;
      // Create the holders for the messages and the attachment data
      localDataStore.messages[chatId] = [];
      localDataStore.attachments[chatId] = {};
      // Chat was created!
      callback(true);
    } else {
      // Chat already exists
      callback(false);
    }
  }

  // Delete the data for one chat / remove a given chat
  static selfContainedChatDelete(chatId, callback) {
    // Find the chat in the data
    if (localDataStore.chats.hasOwnProperty(chatId)) {
      // Clear the chat data
      delete localDataStore.messages[chatId];
      delete localDataStore.attachments[chatId];
      // Remove the chat
      delete localDataStore.chats[chatId];
      // Success!
      callback(true);
    } else {
      // The chat was not found
      callback(false);
    }
  }

  // Add a user data obj to the chat (must be supplied correctely from the chat class)
  static selfContainedChatAddUser(chatId, userData, callback) {
    // Try to find the chat
    if (localDataStore.chats.hasOwnProperty(chatId)) {
      // Add the users data (As this is a copy, directely linked to the in-process data for self
      // contained service, this does not need to be added!)
      // localDataStore.chats[chatId].users.push(userData);
      // Success!
      callback(true);
    } else {
      // Chat not found
      callback(false);
    }
  }

  // Store a message (and its attached image, if supplied)
  static selfContainedMessagesAddMessage(chatId, messageData, messageAttachment, callback) {
    // Fetch the chat
    if (localDataStore.chats.hasOwnProperty(chatId)) {
      // Add the message to the messages array
      localDataStore.messages[chatId].push(messageData);
      // Add the attachment to the attachment data
      if (messageAttachment !== false) {
        localDataStore.attachments[chatId][messageData.id] = messageAttachment;
      }
      // Increment the message count
      localDataStore.chats[chatId].messageCount ++;
      // We added the message
      callback(true);
    } else {
      // No chat to be found
      callback(false);
    }
  }

  // Return a bunch of old messages (also returns the number of total messages!)
  static selfContainedMessagesGetOld(chatId, count, lastMessageId, callback) {
    // Test if chat exists
    if (localDataStore.chats.hasOwnProperty(chatId)) {
      // Find the cound older messages or the count latest, if lastMessageId is no string
      if (typeof lastMessageId !== 'string') {
        // Count latest messages
        callback(localDataStore.messages[chatId].slice(-count));
      } else {
        // Find the lastMessageId message and return the cound older messages
        let messages = [];
        let pastLastMessage = false;
        // Start counting at end
        for (let i = localDataStore.chats[chatId].messageCount - 1; i >= 0 && messages.length < count; i --) {
          if (pastLastMessage) {
            messages.unshift(localDataStore.messages[chatId][i]);
          } else {
            if (localDataStore.messages[chatId][i].id == lastMessageId) pastLastMessage = true;
          }
        }
        // Return the found messages
        callback(messages);
      }
    } else {
      // No chat there
      callback(false);
    }
  }

  // Pipe the attachment data through a socket, if the data exists (for an image attachment)
  static selfContainedAttachmentsPipeImage(chatId, messageId, writeStream) {
    // Find chat
    if (localDataStore.chats.hasOwnProperty(chatId)) {
      // Find the attachment
      if (localDataStore.attachments[chatId].hasOwnProperty(messageId)) {
        // Set the appropriate headers
        writeStream.writeHead(200, {
          'Content-type': 'data:image',
        });
        // Return the data to the stream
        writeStream.end(localDataStore.attachments[chatId][messageId]);
      }
    } else {
      // Close the stream
      stream.end();
    }
  }

  /**
  * imageBlogFromDataUri() converts a
  * data uri image, as send by the
  * client, into a image file string.
  *
  * @param {string} dataUri
  */
  static imageStringFromDataUri(dataUri) {
    return dataUri.replace('data:image/png;base64,', '');
  }

  /**
  * store() returns
  * an object of all
  * avilable storage
  * methods.
  *
  * @return {obj}
  */
  static get store() {
    return {
      SELFCONTAINED: 0,
      MONGODB: 1,
    };
  }

  /**
  * setStore() sets
  * the store method
  * to be used by the
  * global data store.
  */
  static setStore(store) {
    if (typeof store === 'number' && store >= 0 && store <= 1) {
      // Change mode, if the mode is supported
      storeMode = Math.floor(store);
    }
  }

}


// Exports
module.exports = ChatData;
