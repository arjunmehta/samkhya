// Websocket Client Mediator

var debug = require('debugit').add('samsaara:MediatedWebsocket');


function MediatedWebsocketClient(socket, samsaaraConnection, messageHandler, closeHandler) {
    var self = this;

    this.realSocket = socket;
    this.connection = samsaaraConnection;
    this.queue = [];

    socket.onopen = function() {
        self.open = true;
        self.sendQueue();
    };

    socket.onmessage = function(event) {

        debug('Client Incoming Message', event.data);

        samsaaraConnection.incomingPulse.beat();
        messageHandler(samsaaraConnection, event.data);
    };

    socket.onclose = function(event) {
        self.open = false;
        closeHandler(samsaaraConnection);
        self.connection = null;
    };
}

MediatedWebsocketClient.prototype.send = function(message) {

    debug('Client Socket Sending:', message);

    if (this.open === true) {
        this.connection.outgoingPulse.beat();
        this.realSocket.send(message);
    } else {
        this.queueMessage(message);
    }
};

MediatedWebsocketClient.prototype.sendQueue = function(message) {
    var i;
    for (i = 0; i < this.queue.length; i++) {
        this.send(this.queue[i]);
    }
    this.queue = [];
};

MediatedWebsocketClient.prototype.queueMessage = function(message) {
    this.queue.push(message);
};

MediatedWebsocketClient.prototype.close = function(code, message) {
    this.realSocket.close(code, message);
};


// Websocket Server Mediator

function MediatedWebsocketServer(socket, samsaaraConnection, messageHandler, closeHandler) {
    var self = this;

    this.realSocket = socket;
    this.connection = samsaaraConnection;
    this.queue = [];

    socket.on('message', function(message) {

        debug('Server Incoming Message', message);

        samsaaraConnection.incomingPulse.beat();
        messageHandler(samsaaraConnection, message);
    });

    socket.on('close', function(event) {
        self.open = false;
        closeHandler(samsaaraConnection);
        self.connection = null;
    });
}

MediatedWebsocketServer.prototype.send = function(message) {

    debug('Server Socket Sending:', message);

    this.connection.outgoingPulse.beat();
    this.realSocket.send(message);
};

MediatedWebsocketServer.prototype.close = function(code, message) {
    this.realSocket.close(code, message);
};


module.exports = {
    Client: MediatedWebsocketClient,
    Server: MediatedWebsocketServer
};
