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

// The database connection instance
let db = null;

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
* TODO: Add logging(!)
*/
class ChatData {

  /**
  * Functions to retrive
  * data. These functions
  * will connect to the
  * appropriate store.
  */

  static chatGetData(chatId, callback) {
    switch(storeMode) {
      case ChatData.store.SELFCONTAINED: {
        ChatData.selfContainedChatGetData(chatId, callback);
        break;
      }
      case ChatData.store.MONGODB: {
        ChatData.mongoDbChatGetData(chatId, callback);
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
      case ChatData.store.SELFCONTAINED: {
        ChatData.selfContainedChatCreate(chatId, name, callback);
        break;
      }
      case ChatData.store.MONGODB: {
        ChatData.mongoDbChatCreate(chatId, name, callback);
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
      case ChatData.store.SELFCONTAINED: {
        ChatData.selfContainedChatDelete(chatId, callback);
        break;
      }
      case ChatData.store.MONGODB: {
        ChatData.mongoDbChatDelete(chatId, callback);
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
      case ChatData.store.SELFCONTAINED: {
        ChatData.selfContainedChatAddUser(chatId, userData, callback);
        break;
      }
      case ChatData.store.MONGODB: {
        ChatData.mongoDbChatAddUser(chatId, userData, callback);
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
      case ChatData.store.SELFCONTAINED: {
        ChatData.selfContainedMessagesAddMessage(chatId, messageData, messageAttachment, callback);
        break;
      }
      case ChatData.store.MONGODB: {
        ChatData.mongoDbMessagesAddMessage(chatId, messageData, messageAttachment, callback);
        break;
      }
      default: {
        // Selfcontained is the standard
        ChatData.selfContainedMessagesAddMessage(chatId, messageData, messageAttachment, callback);
      }
    }
  }

  static messagesGetOld(chatId, count, lastMessageId, loadedMessagesCount, callback) {
    switch(storeMode) {
      case ChatData.store.SELFCONTAINED: {
        ChatData.selfContainedMessagesGetOld(chatId, count, lastMessageId, callback);
        break;
      }
      case ChatData.store.MONGODB: {
        ChatData.mongoDbMessagesGetOld(chatId, count, loadedMessagesCount, callback);
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
      case ChatData.store.SELFCONTAINED: {
        ChatData.selfContainedAttachmentsPipeImage(chatId, messageId, writeStream);
        break;
      }
      case ChatData.store.MONGODB: {
        ChatData.mongoDbAttachmentsPipeImage(chatId, messageId, writeStream);
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

  // Return a bunch of old messages (uses the messages loaded count, instead of last msg id)
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
      writeStream.end();
    }
  }

  /**
  * Functions that perform
  * the respective storage
  * operations for the mode:
  * MONGODB
  */

  // A 'private' helper function (to not retrive too much data using ChatGetData)
  static mongoDbChatExists(chatId, callback) {
    // Get the collection
    let chatsColl = db.collection('chats');
    if (chatsColl) {
      // Try to find the entry
      chatsColl.findOne(
        { id: chatId },
        { fields: { id: 1 } },
        (err, doc) => {
          // If the document was found, return true
          if (!err && doc) {
            callback(true);
          } else {
            callback(false);
          }
      });
    } else {
      callback(false);
    }
  }

  // Return the chat data to a callback (can also emulate the chat-exists function)
  static mongoDbChatGetData(chatId, callback) {
    // Get the collection
    let chatsColl = db.collection('chats');
    if (chatsColl) {
      // Try to find the entry
      chatsColl.findOne(
        { id: chatId },
        { fields: { id: 1, name: 1, messageCount: 1, users: 1 } },
        (err, doc) => {
          // If the document was found, return its data
          if (!err && doc) {
            callback(doc);
          } else {
            callback(false);
          }
      });
    } else {
      callback(false);
    }
  }

  // Store the data for a new chat / create it's data set
  static mongoDbChatCreate(chatId, name, callback) {
    // Test if chat already exists (and stop creating if it does)
    ChatData.mongoDbChatExists(chatId, exists => {
      if (!exists) {
        // Set up the data obj ()attachmnet
        const chatData = {
          id: chatId,
          name,
          messageCount: 0,
          users: [],
          // This field of the doc contains the messages and is not returned by GetChatData
          messages: [],
        };
        // Write chat to db
        let chatsColl = db.collection('chats');
        if (chatsColl) {
          chatsColl.insertOne(chatData, (err, r) => {
            if (err === null && r.insertedCount === 1) {
              callback(true);
            } else {
              callback(false);
            }
          });
        } else {
          callback(false);
        }
      } else {
        callback(false);
      }
    });
  }

  // Delete the data for one chat / remove a given chat
  static mongoDbChatDelete(chatId, callback) {
    // Get the collection
    let chatsColl = db.collection('chats');
    if (chatsColl) {
      // Try to find the entry
      chatsColl.deleteOne(
        { id: chatId },
        (err, r) => {
          // If the document was deleted, drop its bucket and return true
          if (!err && r.deletedCount === 1) {
            db.bucket(chatId).drop(err => {
              // Chat and bucket are gone!
              callback(true);
            });
          } else {
            callback(false);
          }
      });
    } else {
      callback(false);
    }
  }

  // Add a user data obj to the chat (must be supplied correctely from the chat class)
  static mongoDbChatAddUser(chatId, userData, callback) {
    // Get the collection
    let chatsColl = db.collection('chats');
    if (chatsColl) {
      // Try to insert the users data
      chatsColl.updateOne(
        { id: chatId },
        { $push: { users: userData } },
        (err, r) => {
          // Test if db update was successfull
          if (!err && r.modifiedCount === 1) {
            callback(true);
          } else {
            callback(false);
          }
      });
    } else {
      callback(false);
    }
  }

  // Store a message (and its attached image, if supplied)
  static mongoDbMessagesAddMessage(chatId, messageData, messageAttachment, callback) {
    // Get the collection
    let chatsColl = db.collection('chats');
    if (chatsColl) {
      // Try to insert the message data
      chatsColl.updateOne(
        { id: chatId },
        { $push: { messages: messageData }, $inc: { messageCount: 1 } },
        (err, r) => {
          // Test if db update was successfull
          if (!err && r.modifiedCount === 1) {
            if (messageData.attachment === 1) {
              // Store the attached image
              let bucket = db.bucket(chatId);
              if (bucket) {
                let uploadStream = bucket.openUploadStream(messageData.id);
                uploadStream.on('finish', () => {
                  callback(true);
                }).on('error', (err) => {
                  // FIXME: Do something about this later
                  callback(true);
                });
                uploadStream.end(messageAttachment);
              } else {
                // FIXME: Do something about this later
                callback(true);
              }
            } else {
              // We are done (no image needed)
              callback(true);
            }
          } else {
            callback(false);
          }
      });
    } else {
      callback(false);
    }
  }

  // Return a bunch of old messages
  static mongoDbMessagesGetOld(chatId, count, loadedMessagesCount, callback) {
    // Get the collection
    let chatsColl = db.collection('chats');
    if (chatsColl) {
      // Try to find the entry
      chatsColl.findOne(
        { id: chatId },
        // Filter the messages array (make sure to exclude everything but messages!)
        { fields: { messages: { $slice: [ -(loadedMessagesCount + count), count ] }, id: 0, name: 0, messageCount: 0, users: 0 } },
        (err, doc) => {
          // If the document was found, return its data
          if (!err && doc.hasOwnProperty('messages')) {
            callback(doc.messages);
          } else {
            callback(false);
          }
      });
    } else {
      callback(false);
    }
  }

  // Pipe the attachment data through a socket, if the data exists (for an image attachment)
  static mongoDbAttachmentsPipeImage(chatId, messageId, writeStream) {
    // Get the neccessary bucket
    let bucket = db.bucket(chatId);
    if (bucket) {
      // Test if file exists
      bucket.find({ filename: messageId }, { fields: { filename: 1 } }).count({ limit: 1 }, (err, count) => {
        if (!err && count === 1) {
          // File exists, stream contents
          bucket.openDownloadStreamByName(messageId).pipe(writeStream);
        } else {
          // No file, abort
          writeStream.end();
        }
      });
    } else {
      // No bucket, abort
      writeStream.end();
    }
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
      // Open the database if connected / perform other necessary setup things
      if (storeMode == ChatData.store.MONGODB) {
        // Open the database
        if (db === null) db = new Db();
      } else {
        // Close the DB
        if (db !== null) db.close();
        db = null;
      }
    }
  }

}


// Exports
module.exports = ChatData;
