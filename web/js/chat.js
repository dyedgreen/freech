'use strict';


// The Freech Data & functions
var freech = {

  // Data, that is stored permanentely
  data: {
    users: {},
    expirationTimes: [],
  },

  // Data that is loaded on runtime
  tempData: {
    chatId: '',
    expirationTime: null,
    expirationTimeLeft: 86400000,
    userList: [],
    messages: [],
    totalMessageCount: -1,
    loadingOldMessages: false,
    socket: null,
    connected: false,
  },

  // Function that loads the current data (for useres & expiration times)
  dataLoad: function() {
    // Note about localStorageSafe: If localStorage is not implemented / has no length, this will use cookies instead
    var dataStored = localStorageSafe.getItem('freechData');
    if (typeof dataStored === 'string') {
      try {
        // Decode and load the data
        freech.data = JSON.parse(dataStored);
        // Clean all old useres
        var newExpirationTimes = [];
        freech.data.expirationTimes.forEach(function(expirationData, index) {
          if (expirationData.time < Date.now()) {
            // Delete the old user data
            delete freech.data.users[expirationData.chatId];
          } else {
            // Push the user to new expiration times
            newExpirationTimes.push(expirationData);
          }
        });
        freech.data.expirationTimes = newExpirationTimes;
        return true;
      } catch (e) {}
    }
    return false;
  },

  // Function that stores the current data
  dataStore: function() {
    try {
      localStorageSafe.setItem('freechData', JSON.stringify(freech.data));
      return true;
    } catch (e) {}
    return false;
  },

  // Function that downscales an image
  imageScale: function(dataURI, callback) {
    try {
      // Create the image resources
      var maxHeight = 500;
      var maxWidth = 350;
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
    return freech.urlGetChatId().length === 128;
  },
  urlSetChatId: function(chatId) {
    if (typeof chatId === 'string' && chatId.length === 128) {
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

  // Chat and User Creation / Data Management
  chatExists: function() {
    // Return whether the current chat exists ('soft', client-side verification)
    return freech.tempData.chatId.length === 128;
  },
  chatUserExists: function() {
    // Return whether the current chat was already joined
    return freech.data.users.hasOwnProperty(freech.tempData.chatId);
  },
  chatUserId: function() {
    // Return the id of the user (if present)
    return freech.chatUserExists() ? freech.data.users[freech.tempData.chatId].id : '';
  },
  chatCreateNew: function(callback) {
    // Create a new chat, calls the callback, once done (w. success / error)
    Vue.http.get('/api/chat/new').then(function(res) {
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
      id: freech.randomString(128),
      name: ''.concat(name),
      token: '',
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
          // Store the data
          user.token = res.json().data;
          freech.data.users[freech.tempData.chatId] = user;
          // Add safeguard-expiration
          freech.data.expirationTimes.push({ time: Date.now() + 86400000, chatId: freech.tempData.chatId });
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
        });
      } catch (e) {}
    }
    return false;
  },

  // Socket data sending / reciving functions
  socketConnect: function(callbackOpen, callbackClose, callbackNewMessage) {
    // Create a handshake
    var handshake = freech.socketMessageHandshake();
    if (handshake) {
      // Create the socket and open it (respects http(s) settings)
      var protocol = freech.urlGetProtocol() == 'https' ? 'wss://' : 'ws://';
      var socket = eio(protocol.concat(location.host));
      socket.on('open', function() {
        // Register the callbacks
        socket.on('close', function() {
          // Mark the connection as closed, update the expiration time and hit the callback
          freech.tempData.connected = false;
          freech.dataUpdateExpirationTime();
          callbackClose();
        });
        socket.on('message', function(data) {
          // Store the incoming data
          try {
            var dataObj = JSON.parse(data);
            switch (dataObj.type) {
              // New messages was pushed by the server (WILL CALL UI_UPDATE CALLBACK)
              case 10: {
                // Store the message & the new total message count
                freech.tempData.messages.push(dataObj.message);
                freech.tempData.totalMessageCount = dataObj.totalMessageCount;
                callbackNewMessage();
                break;
              }
              // New user-list was recived
              case 12: {
                // Update the user list
                freech.tempData.userList = dataObj.userList;
                break;
              }
              // The chat expiration data was recived
              case 13: {
                // Store the chat expiration
                freech.tempData.expirationTime = dataObj.expirationTime;
                // Add an expiration element to the local data & store it
                freech.data.expirationTimes.push({ time: dataObj.expirationTime, chatId: freech.tempData.chatId });
                freech.dataStore();
                // Update the countdown requraly from now on
                freech.dataUpdateExpirationTime();
                setInterval(function() {
                  freech.dataUpdateExpirationTime();
                }, 60000);
                break;
              }
              // The loaded old messages where recived
              case 20: {
                // If initial load: new messages callback
                if (freech.tempData.messages.length === 0) {
                  setTimeout(callbackNewMessage, 20);
                }
                // Store the old messages & the total message count
                freech.tempData.messages = dataObj.messages.concat(freech.tempData.messages);
                freech.tempData.totalMessageCount = dataObj.totalMessageCount;
                // Set the old-messages loading to done (if there are more messages to be loaded)
                if (dataObj.totalMessageCount >= freech.tempData.messages.length) freech.tempData.loadingOldMessages = false;
                break;
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
      freech.tempData.socket.send(socketMessage, function(){
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

  // Application runtime / data-update functions
  dataUpdateExpirationTime: function() {
    freech.tempData.expirationTimeLeft = typeof freech.tempData.expirationTime === 'number' ? freech.tempData.expirationTime - Date.now() : 86400000;
  },

};


// The UI functions
var ui = {

  // Ui state / data
  data: {
    modals: {
      newChat: false,
      newUser: false,
      share: false,
      disconnect: false,
    },
    errors: {
      createNewChat: false,
      createNewUser: false,
      createNewUserInput: false,
    },
    loading: {
      full: true, /* the only initially true value */
      creatingChat: false,
      creatingUser: false,
      sendingNewMessage: false,
    },
    content: {
      shareUrl: '',
    }
  },

  // User input data
  input: {
    newUserName: '',
    newMessage: '',
    newImage: '',
  },

  // Scrolls the chat to the correct place when a new message is recived
  chatScroll: function() {
    setTimeout(function() {
      var chatWindow = document.getElementById('chat-messages-scroll');
      chatWindow.scrollTop = chatWindow.scrollHeight;
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

  // Event that creates a new chat
  eventButtonNewChat: function() {
    ui.data.loading.creatingChat = true;
    ui.data.errors.createNewChat = false;
    freech.chatCreateNew(function(success) {
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
    if (ui.input.newUserName.length > 0) {
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
          }, function() {
            // Chat recived new message
            ui.chatScroll();
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
    ui.data.content.shareUrl = encodeURI(location.href);
    ui.data.modals.share = !ui.data.modals.share;
  },

  // Event that sends a new message
  eventButtonSendNewMessage: function() {
    // TODO: Error messages for invalid input
    if (ui.input.newMessage.length + ui.input.newImage.length > 0 && ui.input.newImage.length <= 1000000) {
      // Display loading
      ui.data.loading.sendingNewMessage = true;
      // Send message
      freech.socketSendMessage(ui.input.newMessage, ui.input.newImage, function(success) {
        // Hide loading
        ui.data.loading.sendingNewMessage = false;
        if (success) {
          ui.input.newImage = '';
          ui.input.newMessage = '';
        } else {
          // TODO: Display an error on fail
        }
      });
    }
  },

  // Events that cancels an image send
  eventButtonCancelImage: function() {
    // Clear the image input
    ui.input.newImage = '';
  },

  // Event that loads old messages
  eventButtonLoadOldMessages: function() {
    // Load old messages
    freech.socketLoadOldMessages();
  },

  // Event that is executed on scroll in the chat messages-view
  eventScrollChat: function() {
    var chatWindow = document.getElementById('chat-messages-scroll');
    if (chatWindow.scrollTop <= 0) {
      // Load old messages
      freech.socketLoadOldMessages();
    }
  },

}


// The initial setup
ui.data.loading.full = true;
freech.urlLoadChatId();
freech.dataLoad();
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
  }, function() {
    // Chat recived new message
    ui.chatScroll();
  });
} else if (freech.chatExists()) {
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


// Timestamp filter, returns a formated time like 9:07
Vue.filter('timestamp', function(value) {
	if (typeof value === 'number') {
    var date = new Date(value);
    var newVal = ''.concat(date.getHours()).concat(':');
    newVal = newVal.concat(date.getMinutes() > 9 ? date.getMinutes() : '0'.concat(date.getMinutes()));
    return newVal;
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
  if (value !== freech.chatUserId()) classlist = classlist.concat('notme');
  // The correct color
  try {
    classlist = classlist.concat(' ').concat(colors[chars.indexOf(''.concat(value).charAt(0)) % colors.length]);
  } catch (e) {}
  // Is this user offline?
  if (index !== -1) classlist = classlist.concat(' ').concat(freech.tempData.userList[index].connected ? 'online' : 'offline');
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
      valueArray.push('<a href="'.concat(url).concat('" target="_blank" rel="noopener">'));
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


// The Vue-JS instance
new Vue({
  el: 'body',
  data: {
    // The application data
    freechData: freech.data,
    freechTemp: freech.tempData,
    // The UI state
    uiData: ui.data,
    input: ui.input,
  },
  methods: {
    buttonNewChat: ui.eventButtonNewChat,
    buttonCreateUser: ui.eventButtonCreateUser,
    buttonReconnect: ui.eventButtonReconnect,
    buttonToggleShare: ui.eventButtonToggleShare,
    buttonSendNewMessage: ui.eventButtonSendNewMessage,
    buttonSendImage: ui.eventButtonSendImage,
    buttonCancelImage: ui.eventButtonCancelImage,
    buttonLoadOldMessages: ui.eventButtonLoadOldMessages,
    scrollChat: ui.eventScrollChat,
  },
});
