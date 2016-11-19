'use strict';


// Imports
const Log = require('./classes/Log.js');
const ChatData = require('./classes/ChatData.js');
const ChatServer = require('./classes/ChatServer.js');

// Other setup
Log.setLevel(Log.DEBUG);
ChatData.setStore(ChatData.store.MONGODB);

// Start the chat server
let server = new ChatServer(8080, '/web', true);
server.open();
