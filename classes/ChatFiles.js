'use strict';


// Imports
const fs = require('fs');
const Log = require('./Log.js');
const ApiResponse = require('./ApiResponse.js');
const ChatData = require('./ChatData.js');

// Constans
const filePath = __dirname.replace('/classes', '/data/files');
const tempType = '.ftemp';
const finalType = '.fdat';


/**
* ChatFiles
*
* This class stores files / blobs in the
* local file system under /data/files.
* This can be used to store attachments
* and images for chat messages.
* All the data is assumed to be formated
* as base64 strings (input).
*
* FIXME: Add Logs!
*
* Files are stored as:
* [CHAT_ID]-[MESSAGE_ID].fdat (finalized)
* [CHAT_ID]-[MESSAGE_ID].ftemp (incomplete)
*/
class ChatFiles {

  /**
  * These values will determine the file-storage
  * limits.
  */
  static get limits() {
    return {
      partSize: 8192,
      partCount: 4096,
    };
  }

  /**
  * storeFilePart() will write a
  * file-part to memory.
  * Once the part is written, the callback
  * is called.
  *
  * @param {string} chatId
  * @param {string} messageId
  * @param {string} part
  * @param {function} callback (recives success as bool)
  */
  static storeFilePart(chatId, messageId, part, callback) {
    // Write the part at the end of the temp file
    fs.appendFile(filePath.concat('/').concat(chatId).concat('-').concat(messageId).concat(tempType), ''.concat(part), 'base64', err => {
      // Determine success
      if (typeof callback === 'function') callback(!err);
    });
  }

  /**
  * finalizeFile() will mark the
  * file as finished/complete.
  *
  * @param {string} chatId
  * @param {string} messageId
  * @param {function} callback (takes no arguments)
  */
  static finalizeFile(chatId, messageId, callback) {
    // Rename the corresponding file
    const oldPath = filePath.concat('/').concat(chatId).concat('-').concat(messageId).concat(tempType);
    const newPath = oldPath.replace(tempType, finalType);
    fs.rename(oldPath, newPath, () => {
      if (typeof callback === 'function') callback();
    });
  }

  /**
  * deleteFile() will remove
  * a file completely. This includes
  * any temp data.
  * TODO: Also include functions for
  * 'cleanTempData' and
  * 'deleteAllFilesForChatId' for
  * use by upcoming admin interface.
  *
  * @param {string} chatId
  * @param {string} messageId
  * @param {function} callback (takes no arguments)
  */
  static deleteFile(chatId, messageId, callback) {
    // Remove both files (if they exist)
    const temp = filePath.concat('/').concat(chatId).concat('-').concat(messageId).concat(tempType);
    const final = temp.replace(tempType, finalType);
    fs.unlink(temp, () => {
      fs.unlink(final, () => {
        if (typeof callback === 'function') callback();
      });
    });
  }

  /**
  * pipeFileData() will pipe the data
  * for a given file to a writable stream.
  *
  * @param {string} chatId
  * @param {string} messageId
  * @param {writableStream} stream
  */
  static pipeFileData(chatId, messageId, stream) {
    // Open the file
    const path = filePath.concat('/').concat(chatId).concat('-').concat(messageId).concat(finalType);
    let fileData = fs.createReadStream(path);
    // Handle any errors, in case the files does not exist
    fileData.on('error', () => {
      stream.end();
    });
    // Pipe the files contents
    fileData.pipe(stream);
  }

  /**
  * resolve() will handle requests
  * to the file data api.
  * The path is: /api/file/[CHAT-ID]/[MESSAGE-ID]
  *
  * @param {Url} url
  * @param {http.ServerResponse} res
  */
  static resolve(url, res) {
    // Test, if the input is valid
    if (url.path.length < 4) {
      // Malformed request
      ApiResponse.sendData(res, null, true);
    } else {
      // Determine the requested file
      const chatId = ''.concat(url.path[2]);
      const messageId = ''.concat(url.path[3]);
      // Determine the file type
      ChatData.loadChatMessage(chatId, messageId, message => {
        if (message && (message.hasOwnProperty('image') || message.hasOwnProperty('file'))) {
          // Determine the headers to use (to tell if the file should be downloaded)
          let headers = {};
          if (message.hasOwnProperty('image')) {
            // This is an inline image
            headers['Content-Type'] = message.image.type;
          } else {
            // This is a download request
            headers['Content-Type'] = message.file.type;
            headers['Content-Disposition'] = 'attachment; filename='.concat(message.file.name);
          }
          // Send the headers
          res.writeHead(200, headers);
          // Send data to the client client
          ChatFiles.pipeFileData(chatId, messageId, res);
        } else {
          // Message does not exist
          ApiResponse.sendData(res, null, true);
        }
      });
    }
  }

}


// Expotrs
module.exports = ChatFiles;
