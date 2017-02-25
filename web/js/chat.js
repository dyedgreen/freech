'use strict';


// The Freech Data & functions
var freech = {

  // Data, that is stored permanentely
  data: {
    users: {},
    settings: {
      notifications: false,
      loadMessagesOnScroll: true,
    },
    v: 5,
  },

  // Data that is loaded on runtime
  tempData: {
    urlParams: [],
    chatId: '',
    chatName: 'Chat',
    userList: [],
    usersTyping: [],
    messages: [],
    sendingMessages: [],
    totalMessageCount: -1,
    loadingOldMessages: false,
    socket: null,
    connected: false,
  },

  // Function that loads the current data (for useres & chats)
  dataLoad: function() {
    // Note about localStorageSafe: If localStorage is not implemented / has no length, this will use cookies instead
    var dataStored = localStorageSafe.getItem('freechData');
    if (typeof dataStored === 'string') {
      try {
        // Decode and load the data
        var loadedData = JSON.parse(dataStored);
        // Test if the data model has been updated
        if (loadedData.hasOwnProperty('v') && loadedData.v === freech.data.v) {
          freech.data = loadedData;
        }
        return freech.dataStore();
      } catch (e) {}
    }
    return false;
  },

  // Function that stores the current data
  dataStore: function() {
    try {
      // Create a true copy of the data object
      var storeData = JSON.parse(JSON.stringify(freech.data));
      // Remove all inactive users
      Object.keys(storeData.users).forEach(function(key) {
        if (!storeData.users[key].active) delete storeData.users[key];
      });
      // Store the resulting data
      localStorageSafe.setItem('freechData', JSON.stringify(storeData));
      return true;
    } catch (e) {
      console.log(e);
    }
    return false;
  },

  // Function that downscales an image
  imageScale: function(dataURI, callback) {
    try {
      // Create the image resources
      var maxHeight = 600;
      var maxWidth = 600;
      var height = 0;
      var width = 0;
      var img = document.createElement('img');

      // Do everything else after image has loaded
      img.onload = function() {
        // Work out the size
        if (img.width > img.height) {
          if (img.width > maxWidth) {
            width = maxWidth;
            height = (maxWidth / img.width) * img.height;
          } else {
            width = img.width;
            height = img.height;
          }
        } else {
          if (img.height > maxHeight) {
            width = (maxHeight / img.height) * img.width;
            height = maxHeight;
          } else {
            width = img.width;
            height = img.height;
          }
        }

        // Process the image using the canvas
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Return the result to the callback
        callback(canvas.toDataURL('image/png'));
      };
      img.src = ''.concat(dataURI);
    } catch(e) {
      // Error
      callback('');
    }
  },

  // Rotates an image 90 deg (looses some quality!)
  imageRotate: function(dataURI, callback) {
    try {
      // Create the image resources
      var img = document.createElement('img');

      // Do everything else after image has loaded
      img.onload = function() {
        // Work out the rotated size
        var width = img.height;
        var height = img.width;
        img.heigh = height;
        img.width = width;

        // Rotate the image using the canvas
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.translate(width, height / width);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(img, 0, 0);

        // Return the result to the callback
        callback(canvas.toDataURL('image/png'));
      };
      img.src = ''.concat(dataURI);
    } catch(e) {
      // Error
      callback('');
    }
  },

  // Creates a random string
  randomString: function(length) {
    // Correct the input
    if (typeof length !== 'number' || length < 1) {
      length = 128;
    }
    // Return a random string of said length (used for ids)
    var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    // Build the user template with an id
    var returnString = '';
    for (var i = 0; i < length; i ++) {
      returnString = returnString.concat(chars.substr(Math.floor(Math.random() * (chars.length - 1)), 1));
    }
    return returnString;
  },

  // Url state / chat id
  urlGetChatId: function() {
    return location.search.replace('?', '');
  },
  urlHasChatId: function() {
    return freech.validateChatId(freech.urlGetChatId());
  },
  urlSetChatId: function(chatId) {
    if (freech.validateChatId(chatId)) {
      window.history.pushState('object or string', document.getElementsByTagName('title')[0].innerHTML, location.href.split('?')[0].concat('?').concat(chatId));
    }
  },
  urlLoadChatId: function() {
    if (freech.urlHasChatId()) {
      freech.tempData.chatId = freech.urlGetChatId();
    }
  },
  urlGetProtocol: function() {
    // Cause .protocol has bad browser support
    return location.href.split('://')[0];
  },
  urlGetPlain: function() {
    // Get a plain url (no chat id)
    return location.href.split('?')[0].split('#')[0];
  },
  urlProccessParams: function() {
    // Get the URL parameters (if there are any) anc clean the URL for chatId use
    // Format: ?chatId-Param1-Param2-...
    var urlParams = location.search.replace('?', '').split('-');
    freech.urlSetChatId(urlParams.shift());
    urlParams.forEach(function(value, i) {
      urlParams[i] = decodeURIComponent(value);
    });
    freech.tempData.urlParams = urlParams;
    return urlParams;
  },

  validateChatId: function(chatId) {
    return typeof chatId === 'string' && chatId.length === 32;
  },

  // Temp Data searching functions
  getIndexOfUser: function(userId) {
    for (var i = 0; i < freech.tempData.userList.length; i ++) {
      if (freech.tempData.userList[i].id === userId) return i;
    }
    return -1;
  },
  getNameOfUser: function(userId) {
    var userIndex = freech.getIndexOfUser(userId);
    return userIndex !== -1 ? freech.tempData.userList[userIndex].name : '';
  },
  getUserIsTyping: function(userId) {
    return freech.tempData.usersTyping.indexOf(userId) !== -1;
  },

  // Chat and User Creation / Data Management
  chatExists: function() {
    // Return whether the current chat exists ('soft', client-side verification)
    return freech.validateChatId(freech.tempData.chatId);
  },
  chatUserExists: function() {
    // Return whether the current chat was already joined
    return freech.data.users.hasOwnProperty(freech.tempData.chatId);
  },
  chatUserId: function() {
    // Return the id of the user (if present)
    return freech.chatUserExists() ? freech.data.users[freech.tempData.chatId].id : '';
  },
  chatCreateNew: function(chatName, callback) {
    // Create a new chat, calls the callback, once done (w. success / error)
    var url = '/api/chat/new';
    url = url.concat('?chatName='.concat(encodeURI(chatName)));
    Vue.http.get(url).then(function(res) {
      if (!res.json().error) {
        // Store the data
        freech.tempData.chatId = res.json().data;
        // Update the url
        freech.urlSetChatId(freech.tempData.chatId);
        // Call the callback
        callback(true);
      } else {
        callback(false);
      }
    }, function(){
      callback(false);
    });
  },
  chatCreateUser: function(name, callback) {
    // Creates a user and automatically registers it with the current chat (only if name && chat)
    var user = {
      id: freech.randomString(16),
      name: ''.concat(name),
      chatName: 'Chat',
      token: '',
      active: true,
      secure: true, // This means, that the user was created from this client
    };
    // Try to join the current chat
    if (freech.chatExists() && !freech.chatUserExists()) {
      var url = '/api/chat/join';
      url = url.concat('?chatId='.concat(encodeURI(freech.tempData.chatId)));
      url = url.concat('&userId='.concat(encodeURI(user.id)));
      url = url.concat('&userName='.concat(encodeURI(user.name)));
      // Make HTTP request
      Vue.http.get(url).then(function(res) {
        if (!res.json().error) {
          // Store the data (USES VUE SET TO AVOID CHAT-LIST REACTIVITY PROBLEM FOR NEW CHATS)
          user.token = res.json().data;
          Vue.set(freech.data.users, freech.tempData.chatId, user);
          // Fix state
          freech.dataStore();
          // Call the callback
          callback(true);
        } else {
          callback(false);
        }
      }, function() {
        callback(false);
      });
    } else if (freech.chatUserExists()) {
      callback(true);
    } else {
      callback(false);
    }
  },
  chatLogInUser(name, userId, userToken, callback) {
    // If supplied a name, userId, userToken; this will try to activate the user (if active->true; else->false)
    if (freech.chatExists() && typeof name === 'string' && name.length > 0) {
      // Send activation request to server
      var time = Date.now();
      var url = '/api/chat/activate';
      url = url.concat('?chatId='.concat(encodeURI(freech.tempData.chatId)));
      url = url.concat('&userId='.concat(encodeURI(userId)));
      url = url.concat('&hash='.concat(encodeURI(freech.socketMessageHash(userToken, time))));
      url = url.concat('&time='.concat(encodeURI(time)));
      // Make HTTP request
      Vue.http.get(url).then(function(res) {
        if (!res.json().error && res.json().data === true) {
          // Create the user
          var user = {
            id: ''.concat(userId),
            name: ''.concat(name),
            chatName: 'Chat',
            token: ''.concat(userToken),
            active: true,
            secure: false, // This means, that the user was NOT created from this client
          };
          // Store the data (USES VUE SET TO AVOID CHAT-LIST REACTIVITY PROBLEM FOR NEW CHATS)
          Vue.set(freech.data.users, ''.concat(freech.tempData.chatId), user);
          // Fix state
          freech.dataStore();
          // Call the callback
          callback(true);
        } else {
          callback(false);
        }
      }, function() {
        callback(false);
      });
    } else {
      callback(false);
    }
  },
  // Test if a given chat is active
  chatUserIsActive: function(chatId) {
    if (freech.data.users.hasOwnProperty(chatId)) {
      return freech.data.users[chatId].active;
    }
    return false;
  },
  // Delete the local chat data and deactivate user
  chatUserDeactivate: function(chatId) {
    // Test if a user for this chat exists
    if (freech.data.users.hasOwnProperty(chatId)) {
      // Mark as inactive
      freech.data.users[chatId].active = false;
      // Update presistent data store
      freech.dataStore();
      // Send deactivation request to server
      var time = Date.now();
      var url = '/api/chat/deactivate';
      url = url.concat('?chatId='.concat(encodeURI(chatId)));
      url = url.concat('&userId='.concat(encodeURI(freech.data.users[chatId].id)));
      url = url.concat('&hash='.concat(encodeURI(freech.socketMessageHash(freech.data.users[chatId].token, time))));
      url = url.concat('&time='.concat(encodeURI(time)));
      // Make HTTP request (does nothing with the result)
      Vue.http.get(url);
    }
  },
  // Recover the local chat data and reactivate user
  chatUserActivate: function(chatId) {
    // Test if a user for this chat exists
    if (freech.data.users.hasOwnProperty(chatId)) {
      // Send deactivation request to server
      var time = Date.now();
      var url = '/api/chat/activate';
      url = url.concat('?chatId='.concat(encodeURI(chatId)));
      url = url.concat('&userId='.concat(encodeURI(freech.data.users[chatId].id)));
      url = url.concat('&hash='.concat(encodeURI(freech.socketMessageHash(freech.data.users[chatId].token, time))));
      url = url.concat('&time='.concat(encodeURI(time)));
      // Reactivate the user on the server
      Vue.http.get(url).then(function(res) {
        if (!res.json().error) {
          // The user was successfully reactivated, mark as active (TODO: catch errors)
          freech.data.users[chatId].active = true;
          // Update presistent data store
          freech.dataStore();
        }
      });
    }
  },

  // Socket message functions (these functions create socket messages, they don't send them)
  socketMessageHash: function(userToken, time) {
    // Create a hash
    return forge_sha256(''.concat(userToken).concat(time));
  },
  socketMessageHandshake: function() {
    if (freech.chatExists() && freech.chatUserExists()) {
      try {
        var time = Date.now();
        return JSON.stringify({
          type: 0,
          chatId: freech.tempData.chatId,
          userId: freech.data.users[freech.tempData.chatId].id,
          hash: freech.socketMessageHash(freech.data.users[freech.tempData.chatId].token, time),
          time: time,
        });
      } catch (e) {}
    }
    return false;
  },
  socketMessageNewMessage: function(text, image) {
    if (freech.chatExists() && freech.chatUserExists()) {
      try {
        var time = Date.now();
        return JSON.stringify({
          type: 1,
          messageText: ''.concat(text),
          messageImage: ''.concat(image),
          hash: freech.socketMessageHash(freech.data.users[freech.tempData.chatId].token, time),
          time: time,
        });
      } catch (e) {}
    }
    return false;
  },
  socketMessageLoadMessages: function() {
    if (freech.chatExists() && freech.chatUserExists()) {
      try {
        return JSON.stringify({
          type: 2,
          count: 5,
          lastMessageId: freech.tempData.messages.length > 0 ? freech.tempData.messages[0].id : '',
          loadedMessagesCount: freech.tempData.messages.length,
        });
      } catch (e) {}
    }
    return false;
  },
  socketMessageUpdateStatus: function(status) {
    if (freech.chatExists() && freech.chatUserExists()) {
      try {
        return JSON.stringify({
          type: 3,
          status: ''.concat(status),
        });
      } catch (e) {}
    }
    return false;
  },

  // Socket data sending / reciving functions
  socketConnect: function(callbackOpen, callbackClose, callbackMessagesLoaded) {
    // Create a handshake
    var handshake = freech.socketMessageHandshake();
    if (handshake) {
      // Create the socket and open it (respects http(s) settings)
      var protocol = freech.urlGetProtocol() == 'https' ? 'wss://' : 'ws://';
      var socket = eio(protocol.concat(location.host));
      socket.on('open', function() {
        // Register the callbacks
        socket.on('close', function() {
          // Mark the connection as closed and hit the callback
          freech.tempData.connected = false;
          callbackClose();
        });
        socket.on('message', function(data) {
          // Log the data (is often handy for debugging)
          console.log(data);
          // Store the incoming data
          try {
            var dataObj = JSON.parse(data);
            switch (dataObj.type) {
              // The server handshake was recived (contains the chats name)
              case 0: {
                // Store the chat name
                freech.tempData.chatName = dataObj.chatName;
                // Store the chat name listed in the user list
                freech.data.users[freech.tempData.chatId].chatName = dataObj.chatName;
                // Fix state
                freech.dataStore();
                break;
              }
              // New messages was pushed by the server (WILL CALL UI_UPDATE CALLBACK)
              case 10: {
                // Store the message & the new total message count
                freech.tempData.messages.push(dataObj.message);
                freech.tempData.totalMessageCount = dataObj.totalMessageCount;
                // Remove the message from the sending messages list (assuming that 1 message by me recived == one send)
                if (dataObj.message.userId === freech.chatUserId()) freech.tempData.sendingMessages.shift();
                // Hit the ui update callback
                callbackMessagesLoaded(true);
                // Load the image-attachments from the server
                freech.attachmentGetImages(function(){
                  // On image load, repeat ui update callback
                  callbackMessagesLoaded(true);
                });
                break;
              }
              // New user-list was recived
              case 12: {
                // Update the user list
                freech.tempData.userList = dataObj.userList;
                break;
              }
              // User status updates
              case 13: {
                // Handle the status update (only 'typing' as of now)
                if (dataObj.status == 'typing') {
                  freech.tempData.usersTyping.push(dataObj.userId);
                  setTimeout(function() {
                    // Remove the typing status after 5 seconds
                    freech.tempData.usersTyping.shift();
                  }, 4000);
                }
                break;
              }
              // The loaded old messages where recived (WILL CALL UI_UPDATE CALLBACK)
              case 20: {
                // Store the old messages & the total message count
                freech.tempData.messages = dataObj.messages.concat(freech.tempData.messages);
                freech.tempData.totalMessageCount = dataObj.totalMessageCount;
                // Set the old-messages loading to done (if there are more messages to be loaded)
                if (dataObj.totalMessageCount > freech.tempData.messages.length) freech.tempData.loadingOldMessages = false;
                // Old messages callback
                callbackMessagesLoaded(false);
                // Load the image-attachments from the server
                freech.attachmentGetImages(function(){
                  // On image load, repeat old messages callback
                  callbackMessagesLoaded(false);
                });
                break;
              }
              // Debug stuff
              default: {
                console.warn('Unknown message type:', data);
              }
            }
          } catch (e) {
            console.error(e);
          }
        });
        // Connect to the chat
        socket.send(handshake, function() {
          // Store the socket and set it to connected
          freech.tempData.socket = socket;
          freech.tempData.connected = true;
          // Load some messages
          freech.socketLoadOldMessages();
          // Call the open callback
          callbackOpen();
        });
      });
    } else {
      // Something did not work proper
      callbackClose();
    }
  },
  socketSendMessage: function(text, image, callback) {
    // Create the network message string
    var socketMessage = freech.socketMessageNewMessage(text, image);
    if (socketMessage && freech.tempData.connected) {
      // Send the message
      freech.tempData.socket.send(socketMessage, function() {
        // Add the messsage to the sending messages
        freech.tempData.sendingMessages.push({ text: text, image: image });
        // Hit the callback
        callback(true);
      });
      return true;
    }
    callback(false);
    return false;
  },
  socketLoadOldMessages: function() {
    if (!freech.tempData.loadingOldMessages) {
      var socketMessage = freech.socketMessageLoadMessages();
      if (socketMessage && freech.tempData.connected) {
        freech.tempData.loadingOldMessages = true;
        freech.tempData.socket.send(socketMessage);
      }
    }
  },
  socketUpdateStatus: function(status) {
    // Create the network message string
    var socketMessage = freech.socketMessageUpdateStatus(status);
    if (socketMessage && freech.tempData.connected) {
      freech.tempData.socket.send(socketMessage);
    }
  },

  attachmentGetImages: function(callback) {
    // Go through all messages and request the missing images
    freech.tempData.messages.forEach(function(message, index) {
      if (message.attachment === 1 && !message.hasOwnProperty('image')) {
        // Loads the message attachment image from the server
        var path = '/api/chat/attachment/image/'.concat(freech.tempData.chatId).concat('/').concat(message.id);
        Vue.http.get(path).then(function(res) {
          if (res.data) {
            // Store the data (USES VUE SET!)
            Vue.set(freech.tempData.messages[index], 'image', res.data);
            // Execute callback, if given
            if (typeof callback === 'function') callback();
          }
        }, function() {
          // Image failed to load ...
        });
      }
    });
  },

};


// The UI functions
var ui = {

  // Ui state / data
  data: {
    modals: {
      newChat: false,
      newUser: false,
      settings: false,
      share: false,
      chatList: false,
      disconnect: false,
      sidebarMore: false,
    },
    errors: {
      createNewChat: false,
      createNewUser: false,
      createNewUserInput: false,
      settingsWarning: '',
    },
    loading: {
      full: true, /* the only initially true value */
      creatingChat: false,
      creatingUser: false,
      sendingNewMessage: false,
    },
    content: {
      shareUrl: '',
      shareQr: '',
    },
  },

  // User input data
  input: {
    newChatName: '',
    newUserName: '',
    newMessage: '',
    newImage: '',
  },

  // Feature support detected
  support: {
    notifications: false,
  },

  // Private state
  private: {
    oldScrollHeight: 0,
    isInitialMessageLoad: true,
  },

  // Scrolls the chat to the correct place when a new message is recived / old messages where loaded
  chatScroll: function(contentAddedOnBottom) {
    setTimeout(function() {
      var chatWindow = document.getElementById('chat-messages-scroll');
      if (contentAddedOnBottom) {
        // Scroll to bottom (new message was added)
        chatWindow.scrollTop = chatWindow.scrollHeight;
      } else {
        // Preserve scroll position (old messages where loaded)
        chatWindow.scrollTop = chatWindow.scrollTop + (chatWindow.scrollHeight - ui.private.oldScrollHeight);
      }
      // Store the scroll height
      ui.private.oldScrollHeight = chatWindow.scrollHeight;
    }, 20);
  },

  // Updates the image upload data
  updateImageUpload: function(inputElement) {
    if (inputElement && inputElement.files && inputElement.files.length >= 1) {
      // Read the image data
      var reader = new FileReader();
      reader.onload = function(e) {
        // Load the downscaled image
        freech.imageScale(e.target.result, function(dataURI) {
          ui.input.newImage = dataURI;
          inputElement.value = null;
        });
      };
      reader.readAsDataURL(inputElement.files[0]);
    }
  },

  // Detects all supported features
  detectSupportedFeatures: function() {
    // Test if notifications are supported
    ui.support.notifications = !!('Notification' in window);
  },

  // Event that is called when messages are loaded
  eventMessagesLoaded: function(messagesAreNew) {
    // Scroll the chat
    ui.chatScroll(messagesAreNew);
    // Send a push notification (if the messages are new & this feature is supported)
    if (
      freech.data.settings.notifications &&
      ui.support.notifications &&
      Notification.permission == 'granted' &&
      !document.hasFocus() &&
      messagesAreNew &&
      freech.tempData.messages.length > 0
    ) {
      // Get the last message
      var latestMessage = freech.tempData.messages[freech.tempData.messages.length - 1];
      // Send the notification (if not send by this user)
      if (latestMessage.userId !== freech.chatUserId()) {
        var notification = new Notification(
          ''.concat(freech.getNameOfUser(latestMessage.userId).concat(' has sent a message')),
          {
            body: latestMessage.text ? latestMessage.text : ''.concat(freech.getNameOfUser(latestMessage.userId)).concat(' has sent an image.'),
          }
        );
      }
    }
    // Scroll to bottom, if the first load
    if (ui.private.isInitialMessageLoad) {
      ui.private.isInitialMessageLoad = false;
      ui.chatScroll(true);
    }
  },

  // Event that creates a new chat
  eventButtonNewChat: function() {
    ui.data.loading.creatingChat = true;
    ui.data.errors.createNewChat = false;
    freech.chatCreateNew(ui.input.newChatName, function(success) {
        ui.data.loading.creatingChat = false;
        ui.data.errors.createNewChat = !success;
        // Update ui state on success
        if (success) {
          ui.data.modals.newChat = false;
          ui.data.modals.newUser = true;
        }
    });
  },

  // Event that creates a new user
  eventButtonCreateUser: function() {
    ui.data.loading.creatingUser = true;
    ui.data.errors.createNewUser = false;
    ui.data.errors.createNewUserInput = false;
    // Validate the user name input
    if (ui.input.newUserName.length > 0 && !/^[\s\t\n\r]*$/i.test(ui.input.newUserName)) {
      freech.chatCreateUser(ui.input.newUserName, function(success) {
        ui.data.loading.creatingUser = false;
        ui.data.errors.createNewUser = !success;
        // Update ui state on success
        if (success) {
          ui.data.modals.newChat = false;
          ui.data.modals.newUser = false;
          ui.data.loading.full = true;
          // Connect to the chat
          freech.socketConnect(function() {
            // Chat opened
            ui.data.loading.full = false;
          }, function() {
            // Chat closed
            ui.data.loading.full = false;
            ui.data.modals.disconnect = true;
          }, function(messagesAreNew) {
            // Chat recived new/old message
            ui.eventMessagesLoaded(messagesAreNew);
          });
        }
      });
    } else {
      ui.data.loading.creatingUser = false;
      ui.data.errors.createNewUserInput = true;
    }
  },

  // Event that reconnects to the current chat
  eventButtonReconnect: function() {
    // Reloads the page (assuming, the chat id is set as the url TODO: Could be solved in a more sleek way)
    location.href = location.href;
  },

  // Events that open / close the share modal window (This also updates the share url)
  eventButtonToggleShare: function() {
    // Find share URL and generate QR-Code if changed
    if (ui.data.content.shareUrl !== encodeURI(location.href)) {
      ui.data.content.shareUrl = encodeURI(location.href);
      ui.data.content.shareQr = 'data:image/svg+xml;utf8,'.concat(new QRCode({
        content: ui.data.content.shareUrl,
        padding: 0,
        width: 256,
        height: 256,
        color : '#011627',
        background : '#EEEFED',
        ecl: "M",
      }).svg()).replace(/\#/g, '%23');
    }
    // Open the modal
    ui.data.modals.share = !ui.data.modals.share;
  },

  // Event that sends a new message
  eventButtonSendNewMessage: function() {
    // TODO: Error messages for invalid input
    if (ui.input.newMessage.length + ui.input.newImage.length > 0 && ui.input.newImage.length <= 2000000) {
      // Display loading
      ui.data.loading.sendingNewMessage = true;
      // Send message
      freech.socketSendMessage(ui.input.newMessage, ui.input.newImage, function(success) {
        // Hide loading (This loading waits for the socket to drain, not for the acual package)
        ui.data.loading.sendingNewMessage = false;
        if (success) {
          // Clear the input
          ui.input.newImage = '';
          ui.input.newMessage = '';
          // Scroll the chat to the bottom
          ui.chatScroll(true);
        } else {
          // TODO: Display an error on fail
        }
      });
    } else {
      // TODO: Display an error for invalid message
    }
  },

  // Events that cancels an image send
  eventButtonCancelImage: function() {
    // Clear the image input
    ui.input.newImage = '';
  },

  // Event that rotates an image send (is set)
  eventButtonRotateImage: function() {
    // If image is set, rotate it 90 deg
    if (ui.input.newImage !== '') {
      freech.imageRotate(ui.input.newImage, function(rotatedImage) {
        // If there where no errors, change the image
        if (rotatedImage) {
          ui.input.newImage = rotatedImage;
        }
      });
    }
  },

  // Event that loads old messages
  eventButtonLoadOldMessages: function() {
    // Load old messages
    freech.socketLoadOldMessages();
  },

  // Events that handle the notification dialogue message buttons
  eventButtonToggleSettings: function() {
    // Open / Close the settings modal & reset the settings text error
    ui.data.modals.settings = !ui.data.modals.settings;
    ui.data.errors.settingsWarning = '';
    // Fix the freech data state
    freech.dataStore();
  },

  // Event that opens / closes the chat list
  eventButtonToggleChatList: function() {
    ui.data.modals.chatList = !ui.data.modals.chatList;
  },

  // Event that activates / deactivates (hence: locally deletes/recovers) a chat user
  eventButtonToggleChatUserActive: function(chatId) {
    if (freech.chatUserIsActive(chatId)) {
      freech.chatUserDeactivate(chatId);
    } else {
      freech.chatUserActivate(chatId);
    }
  },

  // Event that opens / closes the more tab
  eventButtonToggleSidebarMore: function() {
    ui.data.modals.sidebarMore = !ui.data.modals.sidebarMore;
  },

  // Event that is executed on scroll in the chat messages-view
  eventScrollChat: function() {
    var chatWindow = document.getElementById('chat-messages-scroll');
    if (chatWindow.scrollTop <= 0 && freech.data.settings.loadMessagesOnScroll) {
      // Load old messages
      freech.socketLoadOldMessages();
    }
  },

  // Asks for notification permission
  eventSettingsEnableNotifications: function() {
    if (ui.support.notifications) {
      // Ask for notification permission (if not denied)
      if (Notification.permission !== 'denied') {
        Notification.requestPermission(function (permission) {
          // Give feedback on fail & reset setting status
          if (permission !== 'granted') {
            freech.data.settings.notifications = false;
            ui.data.errors.settingsWarning = 'Failed to enable notifications.';
          }
        });
      } else {
        // Give feedback on fail & reset setting status
        setTimeout(function(){
          freech.data.settings.notifications = false;
          ui.data.errors.settingsWarning = 'Failed to enable notifications.';
        }, 20);
      }
    }
  },

  // Event loop, that sends out a 'typing' status
  loopDetectTyping: function() {
    // If either image of text input
    if (ui.input.newMessage.length + ui.input.newImage.length > 0) {
      freech.socketUpdateStatus('typing');
    }
  },

}


// The initial setup
ui.data.loading.full = true;
freech.urlProccessParams();
freech.urlLoadChatId();
freech.dataLoad();
ui.detectSupportedFeatures();
// Decide what login-proccess is necessary
if (freech.chatExists() && freech.chatUserExists()) {
  // Try to auto-join the chat
  freech.socketConnect(function() {
    // Chat opened
    ui.data.loading.full = false;
  }, function() {
    // Chat closed
    ui.data.loading.full = false;
    ui.data.modals.disconnect = true;
  }, function(messagesAreNew) {
    // Chat recived new/old message
    ui.eventMessagesLoaded(messagesAreNew);
  });
} else if (freech.chatExists() && freech.tempData.urlParams.length === 3) {
  // A full user is supplied, try to log in. Revert to pre-population if unsuccessful
  // URL-PARAMS: NAME-USERID-USERTOKEN
  var param_name = ''.concat(freech.tempData.urlParams[0]);
  var param_userId = ''.concat(freech.tempData.urlParams[1]);
  var param_userToken = ''.concat(freech.tempData.urlParams[2]);
  freech.chatLogInUser(param_name, param_userId, param_userToken, function (didLogIn) {
    if (didLogIn) {
      // Open the Chat (CODE COPIED FROM CASE1)
      freech.socketConnect(function() {
        // Chat opened
        ui.data.loading.full = false;
      }, function() {
        // Chat closed
        ui.data.loading.full = false;
        ui.data.modals.disconnect = true;
      }, function(messagesAreNew) {
        // Chat recived new/old message
        ui.eventMessagesLoaded(messagesAreNew);
      });
    } else {
      // Show (Pre-Populated) user-name input (CODE COPIED FROM CASE3)
      if (freech.tempData.urlParams.length >= 1 && typeof freech.tempData.urlParams[0] === 'string') {
        ui.input.newUserName = freech.tempData.urlParams[0];
      }
      // Open the create user dialogue
      ui.data.modals.newChat = false;
      ui.data.modals.newUser = true;
      ui.data.loading.full = false;
    }
  });
} else if (freech.chatExists()) {
  // Pre-Populate the user-name input if url provided data
  if (freech.tempData.urlParams.length >= 1 && typeof freech.tempData.urlParams[0] === 'string') {
    ui.input.newUserName = freech.tempData.urlParams[0];
  }
  // Open the create user dialogue
  ui.data.modals.newChat = false;
  ui.data.modals.newUser = true;
  ui.data.loading.full = false;
} else {
  // Open the new chat dialogue
  ui.data.modals.newChat = true;
  ui.data.modals.newUser = false;
  ui.data.loading.full = false;
}
// Start any update loops
setInterval(function() {
  // Send typing events
  ui.loopDetectTyping();
}, 3000);


// Timestamp filter, returns a formated time like 9:07
Vue.filter('timestamp', function(value) {
	if (typeof value === 'number') {
    var months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
    var date = new Date(value);
    var dateNow = new Date();
    var timeStamp = ''.concat(date.getHours()).concat(':');
    timeStamp = timeStamp.concat(date.getMinutes() > 9 ? date.getMinutes() : '0'.concat(date.getMinutes()));
    // If the value is a time yesterday, attach the date
    if (
      Date.now() - value > 86400000 || /* Is more than 24 hours old */
      date.getHours() > dateNow.getHours() || /* Is a hour that had to be yesterday */
      (date.getHours() === dateNow.getHours() && date.getMinutes() > dateNow.getMinutes()) /* IS a minute that had to be yesterday */
    ) {
      return ''.concat(date.getDate()).concat('. ').concat(months[date.getMonth()]).concat(' ').concat(date.getFullYear()).concat(', ').concat(timeStamp);
    } else {
      return timeStamp;
    }
	}
	return value;
});
// Userclass filter, returns the correct conditional classes for an userId
Vue.filter('userclass', function(value) {
  var colors = ['blue', 'pink', 'green', 'red', 'yellow', 'orange', 'purple'];
  var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var index = freech.getIndexOfUser(value);
  var classlist = '';
  // Is this me?
  classlist = classlist.concat(value === freech.chatUserId() ? 'me' : 'notme');
  // The correct color
  try {
    classlist = classlist.concat(' ').concat(colors[chars.indexOf(''.concat(value).charAt(0)) % colors.length]);
  } catch (e) {}
  // Is this user offline?
  if (index !== -1) classlist = classlist.concat(' ').concat(freech.tempData.userList[index].connected ? 'online' : 'offline');
  // Is this user active?
  if (index !== -1) classlist = classlist.concat(' ').concat(freech.tempData.userList[index].active ? 'active' : 'inactive');
  // It this user typing?
  if (freech.getUserIsTyping(value)) classlist = classlist.concat(' typing');
  return classlist;
});
// Username filter, turns userIds into usernames
Vue.filter('username', function(value) {
  var username = freech.getNameOfUser(value);
  return username !== '' ? username : value;
});
// Message filter, turns a message into safe HTML + inserts linebreaks
Vue.filter('message', function(value) {
  // Encode html chars (prevent XSS)
  value = ''.concat(value).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Insert linebreaks and hyperlinks
  var smallChars = 'fijlrtI1!';
  var valueArray = [];
  value.split(' ').forEach(function(word) {
    // Test if word is a (valid) URL
    if (/^(https?:\/\/)?([^\s\@\/\.]+\.)?[^\s\@\/\.]+\.[^\d\s\@\/\.]{2,}(\/[^\s]*)?$/i.test(word)) {
      var url = ''.concat(word);
      // Work out if protocol is in url
      if (!/^https?:\/\//i.test(url)) url = 'http://'.concat(url);
      // Remove any punctuation at the end (as of now, this catches only one!)
      if (/[\.\,\;\:\-\–\…\?\!\/\(\)]$/i.test(url)) url = url.substr(0, url.length - 1);
      // Add the url to the array
      valueArray.push('<a href="'.concat(url).concat('" target="_blank" rel="noopener noreferrer">'));
      valueArray.push(word);
      valueArray.push('</a>');
    } else {
      valueArray.push(word);
    }
  });
  valueArray.forEach(function(word, index) {
    // Rate the word (if not html)
    if (word.indexOf('<') === -1) {
      var score = 0;
      word.split('').forEach(function(char) {
        if (smallChars.indexOf(char) !== -1) {
          score ++;
        } else {
          score += 2;
        }
      });
      // If the rating exeeds 30, make it breakable!
      if (score >= 30) valueArray[index] = word.split('').join('<wbr>');
    }
  });
  return valueArray.join(' ');
});
// Share URL filter, turns chatIds into share urls
Vue.filter('shareurl', function(value) {
  return ''.concat(freech.urlGetPlain()).concat('?').concat(value);
});


// The Vue-JS instance
new Vue({
  el: 'html',
  data: {
    // The application data
    freechData: freech.data,
    freechTemp: freech.tempData,
    // The UI state
    uiData: ui.data,
    input: ui.input,
    support: ui.support,
  },
  methods: {
    buttonNewChat: ui.eventButtonNewChat,
    buttonCreateUser: ui.eventButtonCreateUser,
    buttonReconnect: ui.eventButtonReconnect,
    buttonToggleShare: ui.eventButtonToggleShare,
    buttonSendNewMessage: ui.eventButtonSendNewMessage,
    buttonSendImage: ui.eventButtonSendImage,
    buttonCancelImage: ui.eventButtonCancelImage,
    buttonRotateImage: ui.eventButtonRotateImage,
    buttonLoadOldMessages: ui.eventButtonLoadOldMessages,
    buttonToggleSettings: ui.eventButtonToggleSettings,
    buttonToggleChatList: ui.eventButtonToggleChatList,
    buttonToggleChatUserActive: ui.eventButtonToggleChatUserActive,
    buttonToggleSidebarMore: ui.eventButtonToggleSidebarMore,
    scrollChat: ui.eventScrollChat,
    settingsEnableNotifications: ui.eventSettingsEnableNotifications,
  },
});
