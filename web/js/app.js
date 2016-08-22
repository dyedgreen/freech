'use strict';


// Application functions
var freech = {
	
	// Get the current ChatId from the url
	urlGetChatId: function() {
		return location.search.replace('?', '');
	},
	
	// Test if the url has a chat id
	urlHasChatId: function() {
		return !!(freech.urlGetChatId().length === 128);
	},
	
	// Set the url chat id
	urlSetChatId: function(chatId) {
		window.history.pushState('object or string', document.getElementsByTagName('title')[0].innerHTML, location.href.split('?')[0].concat('?').concat(chatId));
	},
	
	// Get if user index from local list
	indexOfUser: function(userId) {
		for (var i = 0; i < chatData.users.length; i ++) {
			if (chatData.users[i].id == userId) {
				return i;
			}
		}
		return -1;
	},
	
	// Get username for id (from local user list)
	getUserNameFromId: function(userId) {
		var index = freech.indexOfUser(userId);
		return index == -1 ? '' : chatData.users[index].name;
	},
	
	// Create a new chat
	createNewChat: function(callback) {
		Vue.http.get('/api/chat/new').then(function(res){
			if (!res.json().error) {
				callback(res.json().data);
			} else {
				callback(false);
			}
		}, function(){
			callback(false);
		});
	},
	
	// Create a local user
	createUser: function(name) {
		// Generate an id
		var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var id = '';
    for (var i = 0; i < 128; i ++) {
      id = id.concat(chars.substr(Math.floor(Math.random() * (chars.length - 1)), 1));
    }
		// Return the user
		return {
			id: id,
			name: ''.concat(name),
			token: '',
		};
	},
	
	// Register a user in a chat
	registerUser: function(chatId, user, callback) {
		var url = '/api/chat/join';
		url = url.concat('?chatId='.concat(encodeURI(chatId)));
		url = url.concat('&userId='.concat(encodeURI(user.id)));
		url = url.concat('&userName='.concat(encodeURI(user.name)));
		Vue.http.get(url).then(function(res){
			if (!res.json().error) {
				// Hand the callback the user w. his token
				user.token = res.json().data;
				callback(user);
			} else {
				callback(false);
			}
		}, function(){
			callback(false);
		});
	},
	
	// Create hash
	createHash: function(time, user) {
		return forge_sha256(''.concat(user.token).concat(time));
	},
	
	// Create handshake string
	createHandshake: function(chatId, user) {
		var time = Date.now();
		return JSON.stringify({
			type: 0,
			chatId: chatId,
			userId: user.id,
			hash: freech.createHash(time, user),
			time: time,
		});
	},
	
	// Create message string (for sending a new message to the chat)
	createMessage: function(user, text) {
		var time = Date.now();
		return JSON.stringify({
			type: 1,
			messageText: ''.concat(text),
			hash: freech.createHash(time, user),
			time: time,
		});
	},
	
	// Create message request (that will load new messages)
	createMessageRequest: function() {
		var request = {
			type: 2,
			count: 10,
			lastMessageId: chatData.messages.length > 0 ? chatData.messages[0].id : '',
		};
		return JSON.stringify(request);
	},
	
	// Connect to socket
	connectToSocket: function(chatId, user, connectCallback, messageCallback, closeCallback) {
		// Create the socket and open it
		var socket = eio('ws://'.concat(location.host));
		socket.on('open', function() {
			// Register the callbacks
			socket.on('close', closeCallback);
			socket.on('message', messageCallback);
			// Connect to the chat
			socket.send(freech.createHandshake(chatId, user), function() {
				// Pass the socket to connect callback, once the message was send
				connectCallback(socket);
			});
		});
	},
	
	// Scroll chat to bottom (move function somewhere else)
	scrollChat: function() {
		var chatWindow = document.getElementById('chat-messages-scroll');
		chatWindow.scrollTop = chatWindow.scrollHeight;
	},
	
};


// Application runtime data
var chatData = {
	chatId: '',
	user: null,
	messages: [],
	totalMessageCount: -1,
	users: [],
	socket: false,
	connected: false,
	loadingOldMessages: false,
};
var uiData = {
	displayNewChatPrompt: true,
	displayNamePrompt: false,
	displayDisconnectError: false,
	displayShareChatPrompt: false,
};
var userInput = {
	name: '',
	newMessage: '',
};


// Set initial state
if (freech.urlHasChatId()) {
	// Get the chat id
	chatData.chatId = freech.urlGetChatId();
	// Set the ui
	uiData.displayNewChatPrompt = false;
	uiData.displayNamePrompt = true;
}


// Username filter, turning ids into names
Vue.filter('username', function (value) {
	var name = freech.getUserNameFromId(value);
	return name == '' ? value : name;
});

// Userclass filter, returns the correct conditional classes for a userId
Vue.filter('userclass', function (value) {
	var colors = ['blue', 'pink', 'green', 'red', 'yellow', 'orange', 'purple'];
	var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	var index = freech.indexOfUser(value);
	var classlist = '';
	// Is this me?
	if (value != chatData.user.id) classlist = classlist.concat('notme');
	// The correct color
	try {
		classlist = classlist.concat(' ').concat(colors[chars.indexOf(''.concat(value).charAt(0)) % colors.length]);
	} catch (e) {}
	// Is this user offline?
	if (index !== -1) classlist = classlist.concat(' ').concat(chatData.users[index].connected ? 'online' : 'offline');
	return classlist;
});

// Time filter, turning unix numbers into cool labels
Vue.filter('timestamp', function(value) {
	var monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
	if (typeof value === 'number') {
		var age = Date.now() - value;
		// Determine age
		if (age < 120000) {
			// Less than two minute
			return 'just now';
		} else if (age < 1800000) {
			// Less than 30 minutes
			return ''.concat(Math.floor(age / 60000)).concat(' minutes ago');
		} else if (age < 86400000) {
			// Less than a day
			var date = new Date(value);
			return ''.concat(date.getHours()).concat(':').concat(date.getMinutes());
		} else if (age < 31540000000) {
			// Less than a year
			var date = new Date(value);
			return ''.concat(date.getHours()).concat(':').concat(date.getMinutes()).concat(' ').concat(date.getDate()).concat('. ').concat(monthName[date.getMonth()]);
		} else {
			// More than a year
			var date = new Date(value);
			return ''.concat(date.getHours()).concat(':').concat(date.getMinutes()).concat(' ').concat(date.getDate()).concat('. ').concat(monthName[date.getMonth()]).concat(' ').concat(date.getFullYear());
		}
	}
	return value;
});


// Vue JS UI
new Vue({
	el: 'body',
	data: {
		chat: chatData,
		ui: uiData,
		input: userInput,
	},
	methods: {
		
		// The button that creates a new chat
		buttonCreateChat: function() {
			// TODO: Display some loading
			freech.createNewChat(function(chatId) {
				if (chatId) {
					// Store the new chat Id
					chatData.chatId = chatId;
					// Update the window
					freech.urlSetChatId(chatId);
					// Update the UI
					uiData.displayNewChatPrompt = false;
					uiData.displayNamePrompt = true;
				} else {
					// Display some error here later
					console.error('Display chat creation error!');
				}
			});
		},
		
		// The button that joins the user to the chat
		buttonJoinChat: function() {
			// Test if the name is there
			if (userInput.name.length > 0 && userInput.name.length <= 50) {
				// TODO: Display some loading
				chatData.user = freech.createUser(userInput.name);
				freech.registerUser(chatData.chatId, chatData.user, function(newUser) {
					if (newUser) {
						// Store the new user data
						chatData.user = newUser;
						// Update the ui
						uiData.displayNamePrompt = false;
						// Connect to the chat socket
						freech.connectToSocket(chatData.chatId, chatData.user, function(socket) {
							// Connect callback
							chatData.socket = socket;
							chatData.connected = true;
							// Load some chat messages
							socket.send(freech.createMessageRequest(chatData.totalMessageCount, chatData.messages.length));
						}, function(messageString) {
							// Message from socket callback
							var message = JSON.parse(messageString);
							// Test the type
							switch (message.type) {
								// New chat message
								case 10: {
									// Store the data
									chatData.messages.push(message.message);
									chatData.totalMessageCount = message.totalMessageCount;
									// Scroll the chat
									setTimeout(freech.scrollChat, 10);
									break;
								}
								// Loaded old chat messages
								case 20: {
									// Scroll the chat, if this was the first load
									if (chatData.totalMessageCount == -1) setTimeout(freech.scrollChat, 20);
									// Store the data
									chatData.messages = message.messages.concat(chatData.messages);
									chatData.totalMessageCount = message.totalMessageCount;
									// We are done loading
									chatData.loadingOldMessages = false;
									break;
								}
								// New user list
								case 12: {
									chatData.users = message.users;
									break;
								}
							}
						}, function() {
							// Socket closed callback, display the disconnect error
							chatData.connected = false;
							uiData.displayDisconnectError = true;
						});
					} else {
						// Display some error here later
						console.error('Display chat join error!');
					}
				});
			} else {
				// Display some error here later
				console.error('Display name format error!');
			}
		},
		
		// The button that rejoins the chat
		buttonReconnectChat: function() {
			// Reload the window (TODO: Make this nicer)
			location.href = location.href;
		},
		
		// The button that sends a message
		buttonSendMessage: function() {
			// Test the input
			if (userInput.newMessage.length > 0 && userInput.newMessage.length <= 2000 && chatData.connected) {
				// TODO: Display loading
				chatData.socket.send(freech.createMessage(chatData.user, userInput.newMessage), function() {
					// Message send, clear input
					userInput.newMessage = '';
				});
			} else {
				// Display some error here later
				console.error('Display new message format error!');
			}
		},
		
		// The scroll event
		chatWindowScroll: function() {
			var chatWindow = document.getElementById('chat-messages-scroll');
			if (chatWindow.scrollTop < 5 && chatData.loadingOldMessages == false && chatData.totalMessageCount > chatData.messages.length) {
				// Load new messages TODO: Animate
				chatData.loadingOldMessages = true;
				chatData.socket.send(freech.createMessageRequest());
			}
		},
		
		// The share window buttons
		buttonCloseShare: function() {
			uiData.displayShareChatPrompt = false;
		},
		buttonOpenShare: function() {
			uiData.displayShareChatPrompt = true;
		},
		
	},
});
