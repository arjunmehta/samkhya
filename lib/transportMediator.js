var MediatedSocket;

function initialize(socketType, isClient) {
    var type = socketType + '_' + (isClient === 'client' ? 'client' : 'server');

    switch (type) {
        case 'ws_w3c_client':
            MediatedSocket = MediatedW3C;
            break;
        case 'ws_w3c_server':
            MediatedSocket = MediatedW3C;
            break;
        case 'sockjs_client':
            MediatedSocket = MediatedW3C;
            break;
        case 'sockjs_server':
            MediatedSocket = MediatedW3C;
            break;
        case 'socketio_client':
            MediatedSocket = MediatedW3C;
            break;
        case 'socketio_server':
            MediatedSocket = MediatedW3C;
            break;
        case 'primus_server':
            MediatedSocket = MediatedW3C;
            break;
        case 'primus_client':
            MediatedSocket = MediatedW3C;
            break;
        case 'ws_client':
            MediatedSocket = MediatedW3C;
            break;
        case 'ws_server':
            MediatedSocket = MediatedW3C;
            break;
        case 'engineio_client':
            MediatedSocket = MediatedW3C;
            break;
        case 'engineio_server':
            MediatedSocket = MediatedW3C;
            break;
        default:
            break;
    }
}

/*

ENGINEIO
server.on('connection', function (socket) {
  socket.on('message', function(data){ });
  socket.on('close', function(){ });
  socket.send();
});

SOCKETIO
io.on('connection', function(socket){
  socket.on('event', function(data){});
  socket.on('disconnect', function(){});
  socket.emit('event')
});


SOCKJS
server:
echo.on('connection', function(conn) {
    conn.on('data', function(message) {
        conn.write(message);
    });
    conn.on('close', function() {});

    conn.write();
});

client:
sock.onopen = function() {
 console.log('open');
};
sock.onmessage = function(e) {
 console.log('message', e.data);
};
sock.onclose = function() {
 console.log('close');
};

sock.send('test');
sock.close();


PRIMUS
primus.on('connection', function (spark) {
  console.log('connection has the following headers', spark.headers);
  console.log('connection was made from', spark.address);
  console.log('connection id', spark.id);
  spark.on('data', function (data) {
    console.log('received data from the client', data);
    //
    // Always close the connection if we didn't receive our secret imaginary
    // handshake.
    //
    if ('foo' !== data.secrethandshake) spark.end();
    spark.write({ foo: 'bar' });
    spark.write('banana');
  });

  spark.write('Hello world');
  spark.on('end', function(){});
})

Websockets
// server
server.on('connect', function(socket) {
  socket.on('message', function(message) {
    socket.send('echo a message:' + message);
    ......
  });
  socket.on('close', function(){})
}).listen(80);


//client
var socket = new websockets.WebSocket('wss://127.0.0.1');
socket.on('open', function() {
  socket.send('a message');
  ......
});

FAYE
Server:
server.on('upgrade', function(request, socket, body) {
  if (WebSocket.isWebSocket(request)) {
    var ws = new WebSocket(request, socket, body);
    ws.on('message', function(event) {
      ws.send(event.data);
    });
    ws.on('close', function(event) {
      console.log('close', event.code, event.reason);
      ws = null;
    });
  }
});

Client:
ws.on('open', function(event) {
  console.log('open');
  ws.send('Hello, world!');
});

ws.on('message', function(event) {
  console.log('message', event.data);
});

ws.on('close', function(event) {
  console.log('close', event.code, event.reason);
  ws = null;
});
*/

function mediateSocket(socket, samsaaraConnection) {
    return new MediatedSocket(socket, samsaaraConnection);
}



module.exports = {
    initialize: initialize,
    mediateSocket: mediateSocket
};
