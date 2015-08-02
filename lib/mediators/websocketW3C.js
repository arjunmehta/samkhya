function MediatedW3CClient(socket, samsaaraConnection, messageHandler, closeHandler) {
    var self = this;

    this.realSocket = socket;
    this.connection = samsaaraConnection;
    this.queue = [];

    socket.onopen = function() {
        self.open = true;
        self.sendQueue();
    };

    socket.onmessage = function(message) {
        samsaaraConnection.incomingPulse.beat();
        messageHandler(samsaaraConnection, message);
    };

    socket.onclose = function(message) {
        self.open = false;
    };
}

MediatedW3CClient.prototype.send = function(message) {
    if (this.open === true) {
        this.connection.outgoingPulse.beat();
        this.realSocket.send(message);
    } else {
        this.queueMessage(message);
    }
};

MediatedW3CClient.prototype.sendQueue = function(message) {
    var i;
    for (i = 0; i < this.queue.length; i++) {
        this.send(this.queue[i]);
    }
    this.queue = [];
};

MediatedW3CClient.prototype.queueMessage = function(message) {
    this.queue.push(message);
};

module.exports = {
    Client: MediatedW3CClient
};
