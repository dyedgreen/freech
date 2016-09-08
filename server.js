'use strict';


// Imports
const Log = require('./classes/Log.js');
const ChatServer = require('./classes/ChatServer.js');

// Other setup
Log.setLevel(Log.DEBUG);

// Start the chat server
let server = new ChatServer(8080, '/web', true);
server.open();
