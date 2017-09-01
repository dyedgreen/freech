'use strict';


// Imports
const Log = require('./classes/Log.js');
const ChatServer = require('./classes/ChatServer.js');

// Other setup
Log.setLevel(Log.INFO);
Log.setFile('/freech.log'); // Use false to disable logging

// Server config (comment to use default)
const serverOptions = {
  //webRoot: '/web',
  ssl: true,
  //port: 443,
  redirect: {
    //port: 80,
    location: 'www.freech.chat',
  },
};

// Start the chat server
let server = new ChatServer(serverOptions);
server.open();


/**
* How to use this setup:
*
* Important Information:
* The app is tested and works on the current LTS
* v. 6.10.3 and on the current v. 8.4.0
*
* 1) Set the log to the desired level:
*   DEBUG (all logs, not recommended)
*   INFO
*   WARNING (recommended if you need to conserve diskspace)
*   ERROR
*   FATAL
* 2) Configure the server to your needs:
*   1: Set the port you want to use, typically 80 for HTTP or 443 for HTTPS
*   2: Set the web-directory, typically you want to leave it as '/web'
*   3: Set whether you want to use SSL (true/false). If you want to use it, make sure you included a valid certificate and key in /secret
*/
