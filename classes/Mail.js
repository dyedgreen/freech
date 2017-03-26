'use strict';


// Imports
const fs = require('fs');
const email = require('emailjs');

const Log = require('./Log.js');
const ApiResponse = require('./ApiResponse.js');
const JsonData = require('./JsonData.js');
const Db = require('./Db.js');

// Constants
const mailConfig = JsonData.localFileSync(__dirname.replace('/classes', '/secret').concat('/mail.json')).json;
const templates = {
  // EMail mention notification
  notification: {
    html: fs.readFileSync(__dirname.replace('/classes', '/mail').concat('/notification.html'), 'utf8'),
    text: fs.readFileSync(__dirname.replace('/classes', '/mail').concat('/notification.txt'), 'utf8'),
    subject: '{username} mentioned you in a Freech chat',
    data: ['message', 'username', 'url-chat-id', 'url-unsubscribe-address'],
  },
};

// Db connection & email object
let db = new Db();


/**
* Mail
*
* This class is capable of sending html-emails from templates
* to a given e-mail address. It uses mailjs to send the emails.
*/
class Mail {

  constructor(template) {
    // Connect to the mail server
    this.server = email.server.connect(mailConfig.auth);
    // Link the template
    if (templates.hasOwnProperty(template)) {
      this.template = templates[template];
    } else {
      // TODO: Make a default template for text emails
      this.template = templates.notification;
    }
  }

  /**
  * send() takes an e-mail
  * address and an object with
  * data, to be replaced in the
  * email body.
  *
  * @param {string} address
  * @param {object} data
  */
  send(address, data) {
    // Test if the address requested to not recive any emails
    if (db.collection('unsubscribe')) {
      db.collection('unsubscribe').findOne(
        { email: ''.concat(address) },
        { fields: { email: 1 } },
        (err, doc) => {
          // Test if an email has been found
          if (err || !doc) {
            // Create the email from template
            let html = this.template.html;
            let text = this.template.text;
            let subject = this.template.subject;
            this.template.data.forEach(key => {
              if (data.hasOwnProperty(key)) {
                // Test the type of email data
                if (key.indexOf('url-') === 0) {
                  // This is a parameter, that should be given to an url (url-NAMEOFURL-KEYTOREPLACE)
                  const [prefix, urlName, urlKey] = key.split('-');
                  // Replace in email
                  if (mailConfig.url.hasOwnProperty(urlName)) {
                    html = html.replace(`{url-${urlName}}`, mailConfig.url[urlName].replace(`{${urlKey}}`, encodeURI(data[key])));
                    text = text.replace(`{url-${urlName}}`, mailConfig.url[urlName].replace(`{${urlKey}}`, encodeURI(data[key])));
                  }
                } else {
                  // This is a general parameter
                  html = html.replace(`{${key}}`, data[key]);
                  text = text.replace(`{${key}}`, data[key]);
                  subject = subject.replace(`{${key}}`, data[key]);
                }
              }
            });
            // Send the email
            this.server.send({
              from: `${ mailConfig.auth.name } <${ mailConfig.auth.address }>`,
              to: address,
              subject,
              text,
              attachment: [{ data:html, alternative:true }],
            }, (err, message) => {
              // Log about errors (TODO: Do something usefull here)
              if (err) Log.write(Log.ERROR, 'Mail sending error');
            });
          } else {
            // Log this
            Log.write(Log.DEBUG, 'Mail was not send to unsubscribed address', address);
          }
      });
    }
  }

  /**
  * unsubscribe() will
  * store a given email
  * address in the unsubscribe
  * db.
  * TODO: Test if email is valid
  *
  * @param {string} address
  * @param {function} callback
  */
  static unsubscribe(address, callback) {
    // EMail regex
    const addressFormat = /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/i;
    // Test if db is connected and if the address is valid
    if (db.collection('unsubscribe') && addressFormat.test(''.concat(address))) {
      // Put the address into the db
      db.collection('unsubscribe').updateOne(
        { email: ''.concat(address) },
        { email: ''.concat(address) },
        { upsert: true },
        (err, r) => {
          // Test if the email was added
          if (!err && r.upsertedCount + r.modifiedCount === 1) {
            callback(true);
          } else {
            callback(false);
          }
        }
      );
    } else {
      // Error callback
      setImmediate(() => { callback(false); });
    }
    // Log this
    Log.write(Log.DEBUG, 'Attempted to unsubscribe', address);
  }

  /**
  * resubscribe() will
  * remove a given email
  * address in the unsubscribe
  * db.
  *
  * @param {string} address
  * @param {function} callback
  */
  static resubscribe(address, callback) {
    // Test db connection
    if (db.collection('unsubscribe')) {
      // Delete the unsubscribe entry
      db.collection('unsubscribe').deleteOne(
        { email: ''.concat(address) },
        null,
        (err, r) => {
          // Return the success
          if (!err) {
            callback(true);
          } else {
            callback(false);
          }
        }
      );
    } else {
      // Error callback
      setImmediate(() => { callback(false); });
    }
    // Log this
    Log.write(Log.DEBUG, 'Attempted to resubscribe', address);
  }

  /**
  * isSubscribed() determines
  * if a given email is
  * subscribed or not.
  *
  * @param {string} address
  * @param {function} callback
  */
  static isUnsubscribed(address, callback) {
    // Test db connection
    if (db.collection('unsubscribe')) {
      // Delete the unsubscribe entry
      db.collection('unsubscribe').findOne(
        { email: ''.concat(address) },
        { email: 1 },
        (err, doc) => {
          // Return the success
          if (!err && doc) {
            callback(true);
          } else {
            callback(false);
          }
        }
      );
    } else {
      // Error callback (returns 'is subscribed')
      setImmediate(() => { callback(false); });
    }
    // Log this
    Log.write(Log.DEBUG, 'Attempted to determine subscribtion status for', address);
  }

  /**
  * resolve() passes an
  * http api request to the
  * corresponding function,
  * which then returns a response.
  *
  * @param {Url} url the requestet url
  * @param {http.ServerResponse} res the response to write to
  */
  static resolve(url, res) {
    // Test if the request targets the mail endpoint (/api/mail/something ...)
    if (url.path.length > 2) {
      switch (url.path[2]) {
        // Create a new chat
        case 'unsubscribe': {
          // Test if the url has the email parameter
          if (url.data.hasOwnProperty('address')) {
            Mail.unsubscribe(decodeURI(''.concat(url.data.address)), success => {
              // Write api response
              ApiResponse.sendData(res, success, !success);
            });
            return;
          }
          break;
        }
        case 'resubscribe': {
          // Test if the url has the email parameter
          if (url.data.hasOwnProperty('address')) {
            Mail.resubscribe(decodeURI(''.concat(url.data.address)), success => {
              // Write api response
              ApiResponse.sendData(res, success, !success);
            });
            return;
          }
          break;
        }
        case 'isunsubscribed': {
          // Test if the url has the email parameter
          if (url.data.hasOwnProperty('address')) {
            Mail.isUnsubscribed(decodeURI(''.concat(url.data.address)), isUnsubscribed => {
              // Write api response
              ApiResponse.sendData(res, isUnsubscribed, false);
            });
            return;
          }
          break;
        }
      }
    }
    // General error response
    ApiResponse.sendData(res, null, true);
    // Log this shit
    Log.write(Log.WARNING, 'Trying to resolve api request failed (mail)');
  }

}


// Exports
module.exports = Mail;
