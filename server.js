'use strict';


// Imports
const Log = require('./classes/Log.js');
const ChatServer = require('./classes/ChatServer.js');

// Other setup
Log.setLevel(Log.DEBUG);
Log.setFile('/beta.log');

// Start the chat server
let server = new ChatServer(8080, '/web', true);
server.open();


/**
* How to use this setup:
*
* 1) Set the log to the desired level:
*   DEBUG (all logs)
*   INFO
*   WARNING
*   ERROR
*   FATAL
* 2) Configure the server to your needs:
*   1: Set the port you want to use, typically 80 for HTTP or 443 for HTTPS
*   2: Set the web-directory, typically you want to leave it as '/web'
*   3: Set whether you want to use SSL (true/false). If you want to use it, make sure you included a valid certificate and key in /secret
*/
