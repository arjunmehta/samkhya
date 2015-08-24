# samsaara

[![Build Status](https://travis-ci.org/arjunmehta/node-samsaara.svg?branch=master)](https://travis-ci.org/arjunmehta/node-samsaara)

**Note:** *This module is NOT ready to be used. If you happen to have stumbled across it, know it's a Work in Process.*

![samsaara title image](https://raw.githubusercontent.com/arjunmehta/node-samsaara/image/image/splash.png)

A functional, object-oriented bridge to manage, manipulate and interact with large sets of real-time connections.

But it does oh so much more! More specifically:

- **Extends websockets, or websockets based interfaces (sockjs, engine.io etc.) to infinite extensibility.**
- **Execute client methods from server and server methods on client using classic functional patterns (including the passing of callbacks).**
- **Middleware engine for object-oriented extensibility.**
- **A very simple, easy to use, scalable interface.**

## Installation
```bash
npm install --save samsaara
```

## Basic Usage

### Client Side
Using browserify or any other commonjs packager, just require samsaara in your client script and initialize with your socket.

Use the `core` object to perform actions on the samsaara core server.

```javascript
var WebSocket = require('ws')
var ws = new WebSocket('ws://localhost')

var samsaara = require('samsaara').initialize({
    socket: ws
})

// Execute a method on the CORE server
samsaara.core.execute('testMethod')('testing samsaara', [111, 222, 333])
```

### Server Side

```javascript
var WebSocketServer = require('ws').Server
var wss = new WebSocketServer({
    port: 8080
})

var samsaara = require('samsaara').initialize({
    socketType: 'ws'
})

wss.on('connection', function connection(ws) {
    var connection = samsaara.newConnection(ws)
})

samsaara.expose({
    testMethod: function(a_string, number_array) {
        console.log('Test Method Executed', a_string, number_array);
    }
})
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


## Connection API
The client API is quite similar to the server's API. There's just less to it :)

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