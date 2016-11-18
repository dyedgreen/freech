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
      HANDSHAKE: 0, /*NOTICE: SERVER HANDSHAKE IS 0 AS WELL*/
      MESSAGE: 1,
      LOADMESSAGES: 2,
      STATUSUPDATE: 3,
    };
  }

  // Message types pushed by server
  static get UPDATE() {
    return {
      HANDSHAKE: 0, /*NOTICE: CLIENT HANDSHAKE IS 0 AS WELL*/
      NEWMESSAGE: 10,
      REMOVEDMESSAGE: 11,
      USERLIST: 12,
      USERSTATUS: 13,
    };
  }

  // Message types pulled from server
  static get DATA() {
    return {
      MESSAGELIST: 20,
    };
  }

}

// Exports
module.exports = NetworkMessageType;
