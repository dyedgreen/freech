# Freech

Freech is a simple chat server that comes with a web client. The server side part is a NodeJS app
with a MongoDB database. The Freech chat protocol is a simple JSON based protocol that is build
on top of the EngineIO WebSocket implementation.

***

## Features

Freech is a basic chat application and comes with the following features:

* Create and join as many chats as you want using any modern web-browser
* Send files of any type
* Previews for images (.png, .jpeg, .gif)
* Automatic detection of urls in messages
* Automatic OpenGraph url previews
* Automatic detection of email addresses (the user who send the message has the option to send a notification to the mentioned email address)
* Last-seen and typing indicators

### Chat Users

Your chat users are stored in the web client. This means your user is tied to the browser you use
to access Freech. Notice that a new user is created for every chat you join.

### NPM Dependencies

Notice that all NPM dependencies / node_modules are packaged as files with Freech. This is intended
to ensure that a Freech installation will always work correctly regardless of changes or updates
to dependencies.


## Documentation

To run the Freech server you need to install MongoDB and NodeJS. If your system is ready to go, place
the complete Freech application in a folder, configure it and execute the `server.js` file. If you
want you can run Freech using a tool like [forever](https://www.npmjs.com/package/forever) to
ensure it will run continuously. You need to make sure that the user or process executing `server.js`
has read and write access for the Freech folder.

### Configuration

Make sure that your Freech folder is structured like follows:
```
  classes
    [FREECH CLASSES]
  data
    files
  mail
    [FREECH EMAIL TEMPLATES]
  node_modules
    [FREECH NODE MODULES]
  secret
    db.json
    mail.json
    (server.crt) this is needed to use ssl/https
    (server.key) this is needed to use ssl/https
  web
    [FREECH WEB DIRECTORY]
  server.js
```

Configure the MongoDB connection by editing the file `/secret/db.json` according to the template
below. If you set up a local MongoDB using the default settings, the below config should work as is.
```
{
  "host": "localhost",
  "port": 27017,
  "options": [
    { "n": "ssl", "v": false },
    { "n": "connectTimeoutMS", "v": 5000 },
    { "n": "maxPoolSize", "v": 10 }
  ],
  "db": "freech"
}
```

Configure how Freech sends emails by editing `/secret/mail.json` according to the template below.
Do not change the `/chat?{id}` or `/unsubscribe.html?{address}` parts of the urls unless you use a
custom web client.
```
{
  "auth": {
    "name": "Freech",
    "address": "freech@your-host.com",
    "user": "freech@your-host.com",
    "password": "YourPasswordGoesHere",
    "host": "smtp.your-host.com",
    "port": 465,
    "ssl": true
  },
  "url": {
    "root": "http://www.your-host.com",
    "chat": "http://www.your-host.com/chat?{id}",
    "unsubscribe": "http://www.your-host.com/unsubscribe.html?{address}"
  }
}
```

Finally configure the Freech server by setting the desired values in `/server.js`. Here you can
change the log level, where the log will be stored, what port the Freech web server should use and
wether you want to use SSL. If you choose to use SSL, you can also configure a redirect that will
redirect from http to https.
