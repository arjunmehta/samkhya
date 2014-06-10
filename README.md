# samsaara
**Version 0.1.0 (Help Wanted)**

A functional, object-oriented bridge to manage, manipulate and interact with large sets of real-time connections.

Samsaara, at its core, is just a simple realtime connection manager that allows and enables the execution of methods from server to client, or client to server. Its main purpose is to lay syntactic groundwork for working and communicating with large sets of connections reliably.

Its extensibility and unique API make it easy and natural to use. There are a number of middleware extensions already available that add the ablity to create and manage connection groups, share and expose resources, authenticate connections, and even create entirely new systemic contexts(!). With scalability in mind, samsaara's protocol allows for efficient message passing between processes, making it especially suitable for scaling up to multiple server processes and machines.

However, here we'll talk about the core samsaara module. Once you get the basics, definitely have a look at the middleware available.

## Basic Usage
```bash
npm install samsaara
```

### Server Side
```javascript
// create your server and initialize samsaara
var app = require('express')();
var server = http.createServer(app);
var samsaara = require('samsaara').initialize(server, app);

// create your server and initialize samsaara
samsaara.on("newConnection", function(connection){
  connection.execute("ja", Date.now());
});

// expose server side methods to all connected clients
samsaara.expose({
  eka: function(aString, aNumber, anObject, anArray){
    this.execute("response", "hi");
  },
  dvau: function(callback){
    callback("hi");
  }
});

server.listen(9999);
```

### Client Side
```html
<!-- loads compiled client script from the server -->
<script src="/samsaara/samsaara.js"></script>
```

```javascript
// initialize samsaara
samsaara.initialize();

// exposes a set of methods the server can access on this process
samsaara.expose({
  ja: function(connectionDate){
    console.log("connected at:", connectionDate);
  },
  hi: function(message){
    console.log("direct message:", message);
  }
});

// executes exposed method on server and passes arguments to it
samsaara.execute("eka", "aString", 987654321, {a: "a", b: 111}, [111, 222, 333]);

// executes exposed method on server with a callback
samsaara.execute("dvau", function(message){
  console.log("callback message:", message);
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

#### samsaara.on.("connectionConnect", function(connection){})
Called when a new connection connects to the system. Passes through a `connection` reference to the handler.

#### samsaara.on.("connectionDisconnect", function(connection){})
Called when a connection disconnects from the system. Passes through a `connection` reference to the handler.

#### samsaara.on.("connectionInitialized", function(connection){})
Called when a connection has completed initialization after connecting. This is called after it has completed ng with the Passes through a `connection` reference to the handler.

### Server: Interacting with Connections
While you are welcome to find ways of organizing and accessing connections, natively samsaara keeps things simple.

#### samsaara.connections
A list of all connections.

#### samsaara.connection(connectionID`)
Returns the connection with the supplied connection ID.

#### connection.execute(methodName, args,..., callback)
Executes the method supplied by the string `methodName`. Pass in any number of arguments that the receiving function might expect, and end the call with a callback(!) if you'd like.

#### connection.nameSpace(name).execute(methodName, args,..., callback)
Executes a method within a namespace on the connection.

### Server: Exposing Methods
Exposing methods to clients is what makes samsaara so powerful and fun. Methods that are exposed can take any non-circular javascript primitive, and even allows for callbacks. Just use the standard syntax for dealing with callbacks as the last argument to your functions.

#### samsaara.expose(methodSet);
Exposes a set of methods to clients. These are placed in the main namespace.

### Server: Using Namespaces
Namespaces are powerful because the enable so many things that might not be fully apparent at first. With namespaces you can create other primitive objects that route messages to specific namespaces. OR, they're also just a good way to keep your exposed methods organized.

#### samsaara.createLocalNamespace(name, exposedSet)
#### samsaara.nameSpace(name)
#### samsaara.nameSpace(name).expose()


## Client API
The client API is quite similar to the server's API. There's just less to it :)

### Client: Events
#### samsaara.on("initialized", handler)

### Client: Interacting with the Server Process
Currently clients are only connected to a single server process at a time. Perhaps someone would like to write an extension that connects to multiple? :)

#### samsaara.process.execute(methodName, args,..., callback)
#### samsaara.process.nameSpace(name).execute(methodName, args,..., callback);

### Client: Exposing Methods
Exposing methods to the server works much the same way it works on the server.

#### samsaara.expose(methodSet);

### Client: Using Namespaces
Namespaces are powerful because the enable so many things that might not be fully apparent at first. With namespaces you can create other primitive objects that route messages to specific namespaces. OR, they're also just a good way to keep your exposed methods organized.

#### samsaara.createNamespace(name, exposedSet)
#### samsaara.nameSpace(name)
#### samsaara.nameSpace(name).expose()


## License
The MIT License (MIT)

Copyright (c) 2014 Arjun Mehta

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.