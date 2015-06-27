# samsaara
**Version 0.1.0 (Help Wanted)**

A functional, object-oriented bridge to manage, manipulate and interact with large sets of real-time connections.

Extends websockets, or websockets based interfaces (sockjs, engine.io etc.) to infinite extensibility.

Samsaara, at its core, is just a simple realtime connection manager that allows and enables the execution of methods from server to client, or client to server. Its main purpose is to lay syntactic groundwork for working and communicating with large sets of connections reliably.

Its extensibility and unique API make it easy and natural to use. There are a number of middleware extensions already available that add the ablity to create and manage connection groups, share and expose resources, authenticate connections, and even create entirely new systemic contexts(!). With scalability in mind, samsaara's protocol allows for a balance between efficient message passing between processes and flexibility with message handling.

However, here we'll talk about the core samsaara module. Once you get the basics, definitely have a look at the middleware available.

## Basic Usage
```bash
npm install --save samsaara
```

### Server Side
```javascript
// create your server, socket and initialize samsaara

var ws = new WebSocket('ws://www.host.com/path');
var samsaara = require('samsaara').initialize({socket: ws});

// create your server and initialize samsaara
samsaara.on('connection', function(connection){
  connection.execute('ja', Date.now());
});

// expose server side methods to all connected clients
samsaara.expose({  
  eka: function(aString, aNumber, anObject, anArray){
    this.execute('response', 'hi');
  },
  dvau: function(callback){
    callback('hi');
  }
});

server.listen(9999);
```

### Client Side
If you're using browserify or something of the sort, just require samsaara in your client script.

```javascript
var samsaara = require('samsaara');

// initialize samsaara
samsaara.initialize();

// exposes a set of methods the server can access on this process
samsaara.expose({
  ja: function(connectionDate){
    console.log('connected at:', connectionDate);
  },
  hi: function(message){
    console.log('direct message:', message);
  }
});

// executes exposed method on server and passes arguments to it
samsaara.execute('eka', 'aString', 987654321, {a: 'a', b: 111}, [111, 222, 333]);

// executes exposed method on server with a callback
samsaara.execute('dvau', function(message){
  console.log('callback message:', message);
});
```

## Primitives
At samsaara's core, there are 3 main components to interact with: connections; namespaces; and exposed methods. Middleware modules handle the rest (groups, resources, ipc, authentication etc.) but they're all built on these fundamental components.

### Connections
A `connection` is just a representation of a connected client and is the most fundamental and important object in the system. Samsaara uses a realtime channel (either websockets, sockjs, engine.io etc.) to communicate with the connection and pass messages between client and server processes.

Refer to the API to see details on interfacing with the connection and its events.

### Exposed Methods
`exposed` methods expose server functions to clients and viceversa to allow you to seamlessly work between client and server, pass arguments between them, and program as if they were native, local* objects.

Refer to the API to see details on using exposed methods to interact with connections.

*(uhmmm we're trying anyway)

### Namespaces
A `nameSpace` is a discrete space for exposed methods. Namespaces basically allow you to separate groups of exposed methods. But even more importantly they allow for almost infinite extensibility, giving modules the ability to route messages and functionality.

Refer to the API to see details on using nameSpaces.

## Server API
Items denoted with * are optional

### Server: Key Events
While slightly verbose, events in samsaara are meant to share a common syntax and are related to **objects** instead of messages.

#### samsaara.on('connection', function(connection){})
Called when a new connection connects to the system. Passes through a `connection` reference to the handler.

#### samsaara.on('disconnect', function(connection){})
Called when a connection disconnects from the system. Passes through a `connection` reference to the handler.

#### samsaara.on('initialized', function(connection){})
Called when a connection has completed initialization after connecting. This is called after it has completed ng with the Passes through a `connection` reference to the handler.


### Server: Interacting with Connections
While you are welcome to find ways of organizing and accessing connections, natively samsaara keeps things simple.

#### samsaara.connections
A list of all connections.

#### samsaara.connection(connection_id)
Returns the connection with the supplied connection ID.

#### connection.execute(method_name, args,..., callback)
Executes on the client the exposed method of the given string `method_name`. Pass in any number of arguments that the receiving function might expect, and end the call with a callback(!) if you'd like. Currently, only the last argument can be a function.

#### connection.nameSpace(namespace_name).execute(method_name, args,..., callback)
Executes a method within a namespace on the connection.

### Server: Exposing Methods
Exposing methods to clients is what makes samsaara so powerful and fun. Methods that are exposed can take any non-circular javascript primitive, and even allows for callbacks. Just use the standard syntax for dealing with callbacks as the last argument to your functions.

#### samsaara.expose(method_set);
Exposes a set of methods to clients. These are placed in the main namespace.

### Server: Using Namespaces
Namespaces are powerful because the enable so many things that might not be fully apparent at first. With namespaces you can create other primitive objects that route messages to specific namespaces. OR, they're also just a good way to keep your exposed methods organized.

#### samsaara.createNamespace(name, exposedSet)
#### samsaara.nameSpace(name)
#### samsaara.nameSpace(name).expose()


## Client API
The client API is quite similar to the server's API. There's just less to it :)

### Client: Events
#### samsaara.on('initialized', handler)

### Client: Interacting with the Core Process
Currently clients are only connected to a single server process at a time. Perhaps someone would like to write an extension that connects to multiple? :)

#### samsaara.execute(method_name, args,..., callback)
#### samsaara.nameSpace(name).execute(method_name, args,..., callback);

### Client: Exposing Methods
Exposing methods to the server works much the same way it works on the server.

#### samsaara.expose(method_set);

### Client: Using Namespaces
Namespaces are powerful because they enable so many things that might not be fully apparent at first. With namespaces you can create other primitive objects that route messages to specific namespaces. OR, they're also just a good way to keep your exposed methods organized.

#### samsaara.createNamespace(name, exposedSet)
#### samsaara.nameSpace(name)
#### samsaara.nameSpace(name).expose()


## License
The MIT License (MIT)

Copyright (c) 2014 Arjun Mehta

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the 'Software'), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.