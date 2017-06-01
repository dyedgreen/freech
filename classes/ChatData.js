'use strict';


// Imports
const Db = require('./Db.js');
const Log = require('./Log.js');


// Constants
let db = new Db();


/**
* ChatData
*
* This class retrives data from the db and stores data
* to the db.
* Notice that the data that is loaded, will be checked,
* while the data that is written, is expected to be
* valid.
*/
class ChatData {

  /**
  * existsChat() does
  * the same as loadChat,
  * but it won't return any
  * data.
  *
  * @param {string} chatId
  * @param {function} callback
  */
  static existsChat(chatId, callback) {
    // Test if the db is connected
    if (db.collection('chats')) {
      // Load the data from the DB
      db.collection('chats').findOne(
        { id: ''.concat(chatId) },
        { fields: { id: 1 } },
        (err, doc) => {
          if (!err && doc && typeof doc === 'object') {
            // Chat does exist
            if (typeof callback === 'function') callback(true);
          } else {
            // No chat found
            if (typeof callback === 'function') callback(false);
          }
      });
    } else {
      // No data could be found
      setImmediate(() => {
        if (typeof callback === 'function') callback(false);
      });
    }
    // Log this event
    Log.write(Log.DEBUG, 'Chat data performed chat lookup');
  }

  /**
  * loadChat() will
  * return a chats data
  * from the db.
  * If the chat data was not
  * found, the callback
  * recives false.
  *
  * @param {string} chatId
  * @param {function} callback
  */
  static loadChat(chatId, callback) {
    // Test if the db is connected
    if (db.collection('chats')) {
      // Load the data from the DB
      db.collection('chats').findOne(
        { id: ''.concat(chatId) },
        { fields: { id: 1, name: 1, messageCount: 1, users: 1 } },
        (err, doc) => {
          if (!err && doc && typeof doc === 'object') {
            // Return a safe chat data obj
            let data = {};
            let users = [];
            // Validate all the data
            data.id = ''.concat(chatId);
            data.name = doc.hasOwnProperty('name') ? ''.concat(doc.name) : 'Chat';
            users = doc.hasOwnProperty('users') ? doc.users : [];
            data.users = [];
            data.messageCount = doc.hasOwnProperty('messageCount') ? doc.messageCount : 0;
            // Validate each users data (missing data is either added, or reason to drop the user)
            users.forEach(user => {
              if (
                typeof user.id === 'string' &&
                typeof user.name === 'string' &&
                typeof user.token === 'string'
              ) {
                // Add missing data
                if (typeof user.active !== 'boolean') user.active = true;
                if (typeof user.lastSeen !== 'number') user.lastSeen = Date.now();
                // User is valid, add to list
                data.users.push(user);
              }
            });
            // Return the chat data to the callback
            setImmediate(() => {
              if (typeof callback === 'function') callback(data);
            });
            // Log about this
            Log.write(Log.DEBUG, 'Chat data loaded for id', chatId);
          } else {
            // No data could be found
            setImmediate(() => {
              if (typeof callback === 'function') callback(false);
            });
            // Log about this
            Log.write(Log.DEBUG, 'Chat data did not load for id', chatId);
          }
      });
    } else {
      // No data could be found
      setImmediate(() => {
        if (typeof callback === 'function') callback(false);
      });
      // Log this
      Log.write(Log.DEBUG, 'Chat data did not load for id', chatId);
    }
  }

  /**
  * loadChatMessages() will
  * retrive an exerpt from
  * all the messages send to
  * the chat.
  * The callback allways recives
  * an array, containing 0 or more
  * valid message objects.
  *
  * @param {string} chatId
  * @param {number} count
  * @param {number} loadedMessagesCount
  * @param {function} callback
  */
  static loadChatMessages(chatId, count, loadedMessagesCount, callback) {
    // This is a wrapper for a certain query
    ChatData.loadChatMessagesByQuery(
      { id: ''.concat(chatId) },
      { fields: { messages: { $slice: [ -(loadedMessagesCount + count), count ] }, id: 0, name: 0, messageCount: 0, users: 0 } },
      callback
    );
  }

  /**
  * loadChatMessage() will
  * retrive a single chat
  * message.
  * The callback recives the
  * message or false.
  *
  * @param {string} chatId
  * @param {string} messageId
  * @param {function} callback
  */
  static loadChatMessage(chatId, messageId, callback) {
    // This is a wrapper for a certain query
    ChatData.loadChatMessagesByQuery(
      { id: ''.concat(chatId) },
      { fields: { messages: { $elemMatch: { id: ''.concat(messageId) } }, id: 0, name: 0, messageCount: 0, users: 0 } },
      messages => {
        // Map the return from an array to a single message
        if (messages.length > 0) {
          callback(messages[0]);
        } else {
          callback(false);
        }
      }
    );
  }

  /**
  * loadChatMessagesByQuery() will
  * load messages according to
  * a mongo-db query obj.
  * This should not be called
  * directely.
  *
  * This is designed in this way,
  * to avoid parsing the messages
  * in multiple different places.
  */
  static loadChatMessagesByQuery(query, fields, callback) {
    // Test if the db is connected
    if (db.collection('chats')) {
      db.collection('chats').findOne(
        query,
        // Filter the messages array (make sure to exclude everything but messages!)
        fields,
        (err, doc) => {
          // Proccess db results
          let messages = [];
          if (!err && typeof doc === 'object' && doc.hasOwnProperty('messages') && Array.isArray(doc.messages)) {
            // Create the array with the message content
            doc.messages.forEach(dbEntry => {
              if (typeof dbEntry === 'object') {
                // Add all the available required message fields
                let message = {
                  id: ''.concat(dbEntry.id),
                  userId: ''.concat(dbEntry.userId),
                  time: ''.concat(dbEntry.time),
                };
                // Add all the available optional message fields
                if (dbEntry.hasOwnProperty('text')) message.text = ''.concat(dbEntry.text);
                if (dbEntry.hasOwnProperty('image')) message.image = true;
                if (dbEntry.hasOwnProperty('emails')) message.emails = [].concat(dbEntry.emails);
                if (dbEntry.hasOwnProperty('systemMessage')) message.systemMessage = ''.concat(dbEntry.systemMessage);
                // Add the message to the list
                messages.push(message);
              }
            });
          }
          // Return messages to callback
          setImmediate(() => {
            if (typeof callback === 'function') callback(messages);
          });
      });
    } else {
      // No messages could be loaded
      setImmediate(() => {
        if (typeof callback === 'function') callback([]);
      });
      // Log about this
      Log.write(Log.DEBUG, 'Chat messages did not load for chat with id', chatId);
    }
  }

  /**
  * addChat() will take
  * the data for a given
  * chat and store it to
  * the database.
  *
  * @param {string} chatId
  * @param {object} chat
  * @param {function} callback
  */
  static addChat(chatId, chat, callback) {
    // Test if the chat already exists
    ChatData.existsChat(chatId, exists => {
      if (!exists) {
        // Store the chat
        if (db.collection('chats')) {
          db.collection('chats').insertOne(chat, (err, r) => {
            if (err === null && r.insertedCount === 1) {
              if (typeof callback === 'function') callback(true);
            } else {
              if (typeof callback === 'function') callback(false);
            }
          });
        } else {
          // Db error
          setImmediate(() => {
            if (typeof callback === 'function') callback(false);
          });
          // Log about this
          Log.write(Log.DEBUG, 'Chat could not be stored with id', chatId);
        }
      } else {
        // The chat already exists, return false
        setImmediate(() => {
          if (typeof callback === 'function') callback(false);
        });
        // Log about this
        Log.write(Log.DEBUG, 'Chat already exists for id', chatId);
      }
    });
  }

  /**
  * addChatMessage() will
  * store a new message to
  * the database. This will
  * not validate the data!
  * TODO: Attachments are currently
  * strings, maybe make them streams
  * later!
  *
  * @param {string} chatId
  * @param {object} message
  * @param {string} attachment (any attachment data, that should be stored for the messages id)
  * @param {function} callback
  */
  static addChatMessage(chatId, message, attachment, callback) {
    // Test it the db is connected
    if (db.collection('chats')) {
      db.collection('chats').updateOne(
        { id: ''.concat(chatId) },
        { $push: { messages: message }, $inc: { messageCount: 1 } },
        (err, r) => {
          // Test if the db update did work
          if (!err && r.modifiedCount === 1) {
            // If there is an attachment, store it
            if (attachment) {
              let bucket = db.bucket(chatId);
              if (bucket) {
                let uploadStream = bucket.openUploadStream(message.id);
                uploadStream.on('finish', () => {
                  // Message added, attachment data added.
                  setImmediate(() => {
                    if (typeof callback === 'function') callback(true);
                  });
                }).on('error', (err) => {
                  // Message added, attachment data failed to add. FIXME: Do something about this!
                  setImmediate(() => {
                    if (typeof callback === 'function') callback(true);
                  });
                });
                uploadStream.end(''.concat(attachment));
              } else {
                // Message added, attachment data failed to add. FIXME: Do something about this!
                setImmediate(() => {
                  if (typeof callback === 'function') callback(true);
                });
              }
            } else {
              // Message without attachment data added successfully!
              setImmediate(() => {
                if (typeof callback === 'function') callback(true);
              });
            }
          } else {
            // No messages could be added
            setImmediate(() => {
              if (typeof callback === 'function') callback(false);
            });
          }
      });
    } else {
      // No messages could be added
      setImmediate(() => {
        if (typeof callback === 'function') callback(false);
      });
      // Log about this
      Log.write(Log.DEBUG, 'Chat messages was not added for chat with id', chatId);
    }
  }

  /**
  * addChatUser() will
  * store the data for a
  * new user to the chat.
  * This will not validate
  * the user.
  *
  * @param {string} chatId
  * @param {object} user
  * @param {function} callback
  */
  static addChatUser(chatId, user, callback) {
    // Test Db connection
    if (db.collection('chats')) {
      // Try to insert the users data
      db.collection('chats').updateOne(
        { id: ''.concat(chatId) },
        { $push: { users: user } },
        (err, r) => {
          // Test if db update was successfull
          if (!err && r.modifiedCount === 1) {
            setImmediate(() => {
              if (typeof callback === 'function') callback(true);
            });
          } else {
            setImmediate(() => {
              if (typeof callback === 'function') callback(false);
            });
          }
      });
    } else {
      // User could not be added
      setImmediate(() => {
        if (typeof callback === 'function') callback(false);
      });
      // Log about this
      Log.write(Log.DEBUG, 'User could not be added for chat with id', chatId);
    }
  }

  /**
  * updateChatUser() will
  * update the data for
  * a given user. This will
  * not validate the new data.
  *
  * @param {string} chatId
  * @param {string} userId
  * @param {object} newUser
  * @param {function} callback
  */
  static updateChatUser(chatId, userId, newUser, callback) {
    // Try to connect to the database
    let chatsColl = db.collection('chats');
    if (chatsColl) {
      // Try to insert the users data
      chatsColl.updateOne(
        { id: ''.concat(chatId), 'users.id': ''.concat(userId) },
        { $set: { 'users.$': newUser } },
        (err, r) => {
          // Test if db update was successfull
          if (!err && r.modifiedCount === 1) {
            setImmediate(() => {
              if (typeof callback === 'function') callback(true);
            });
          } else {
            setImmediate(() => {
              if (typeof callback === 'function') callback(false);
            });
          }
      });
    } else {
      // User could not be updated
      setImmediate(() => {
        if (typeof callback === 'function') callback(false);
      });
      // Log about this
      Log.write(Log.DEBUG, 'User could not be updated for chat with id', chatId);
    }
  }

  /**
  * pipeAttachment() will pipe
  * the attachment of a given
  * message to a stream.
  * If the attachment does not
  * exist, this will terminate
  * the stream.
  *
  * @param {string} chatId
  * @param {string} messageId
  * @param {stream} stream
  */
  static pipeAttachment(chatId, messageId, stream) {
    // Get the neccessary bucket
    let bucket = db.bucket(''.concat(chatId));
    if (bucket) {
      // Test if file exists
      bucket.find({ filename: ''.concat(messageId) }, { fields: { filename: 1 } }).count({ limit: 1 }, (err, count) => {
        if (!err && count === 1) {
          // File exists, stream contents
          bucket.openDownloadStreamByName(''.concat(messageId)).pipe(stream);
        } else {
          // No file, stop the stream
          stream.end();
        }
      });
    } else {
      // No bucket, stop the stream
      stream.end();
    }
  }

}


// Export
module.exports = ChatData;
