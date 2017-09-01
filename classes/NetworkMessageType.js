'use strict';


/**
* NetworkMessage
*
* Messages are JSON constructed in the following way:
  {
    type: {number},
    (time: {unix-milliseconds / number},
    data: {any})
  }
*/
class NetworkMessageType {

  // Message types send by user
  static get USER() {
    return {
      HANDSHAKE: 0, /*NOTE: SERVER HANDSHAKE IS 0 AS WELL*/
      MESSAGE: 1,
      LOADMESSAGES: 2,
      STATUSUPDATE: 3,
      EMAILNOTIFICATION: 4,
      FILE: 5,
      FILEPART: 6,
      UPDATEMESSAGE: 7,
    };
  }

  // Message types pushed by server
  static get UPDATE() {
    return {
      HANDSHAKE: 0, /*NOTE: CLIENT HANDSHAKE IS 0 AS WELL*/
      NEWMESSAGE: 10,
      UPDATEMESSAGE: 11,
      USERLIST: 12,
      USERSTATUS: 13,
    };
  }

  // Message types pulled from server (data, that is send as a response to a user message)
  static get DATA() {
    return {
      MESSAGELIST: 20,
      EMAILNOTIFICATIONSENT: 21,
      FILEACCEPT: 22, /*can also contain error*/
      FILEACC: 23, /*also sends errors*/
    };
  }

}

// Exports
module.exports = NetworkMessageType;
