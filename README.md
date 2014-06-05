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
var server = http.createServer();
var samsaara = require('samsaara').initialize(server);

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

#### samsaara.connection(`string:`connectionID`)
Returns the connection with the supplied connection ID.

#### connection.execute(`string:`methodName, args*, `function:`callback*)
Executes the method supplied by the string `methodName`. Pass in any number of arguments that the receiving function might expect, and end the call with a callback(!) if you'd like.

#### connection.nameSpace(`string:`name).execute(`string:`methodName, args,..., `function:`callback*)
Executes a method within a namespace on the connection.

### Server: Exposing Methods
Exposing methods to clients is what makes samsaara so powerful and fun. Methods that are exposed can take any non-circular javascript primitive, and even allows for callbacks. Just use the standard syntax for dealing with callbacks as the last argument to your functions.

#### samsaara.expose(`object:`methodSet);
Exposes a set of methods to clients. These are placed in the main namespace.

### Server: Using Namespaces
Namespaces are powerful because the enable so many things that might not be fully apparent at first. With namespaces you can create other primitive objects that route messages to specific namespaces. OR, they're also just a good way to keep your exposed methods organized.

#### samsaara.createLocalNamespace(`string:`name, `object:`{exposedSet})
#### samsaara.nameSpace(`string:`name)
#### samsaara.nameSpace(`string:`name).expose()


## Client API
The client API is quite similar to the server's API. There's just less to it :)

### Client: Events
#### samsaara.on("initialized", function(){})

### Client: Interacting with the Server Process
Currently clients are only connected to a single server process at a time. Perhaps someone would like to write an extension that connects to multiple? :)

#### samsaara.p.execute(`string:`methodName, args*, `function:`callback*)
#### samsaara.p.nameSpace(`string:`name).execute(`string:`methodName, args,..., `function:`callback);

### Client: Exposing Methods
Exposing methods to the server works the same as it does the opposite way!

#### samsaara.expose(`object:`methodSet);
Exposes a set of methods to clients. These are placed in the main namespace.

### Client: Using Namespaces
Namespaces are powerful because the enable so many things that might not be fully apparent at first. With namespaces you can create other primitive objects that route messages to specific namespaces. OR, they're also just a good way to keep your exposed methods organized.

#### samsaara.createNamespace(`string:`name, `object:`{exposedSet})

#### samsaara.nameSpace(`string:`name)
Returns an object representing a **SERVER** namespace with which you can execute within.

#### samsaara.nameSpace(`string:`name).expose()



