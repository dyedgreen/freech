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
      HANDSHAKE: 0,
      MESSAGE: 1,
      LOADMESSAGES: 2,
    };
  }

  // Message types pushed by server
  static get UPDATE() {
    return {
      NEWMESSAGE: 10,
      REMOVEDMESSAGE: 11,
      USERLIST: 12,
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
