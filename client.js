var EventEmitter = require('events').EventEmitter;
var util = require('util');
var heartbeats = require('heartbeats');

var routeController = require('./lib/controllers/routeController');
var connectionController = require('./lib/controllers/connectionController');
var executionController = require('./lib/controllers/executionController');

var helper = require('./lib/utils/helper');
var parser = require('./lib/utils/parser');
var middleware = require('./lib/utils/middleware');

var heart;

util.inherits(Samsaara, EventEmitter);


function Samsaara() {

    EventEmitter.call(this);

    routeController.setParser(parser);
    connectionController.initialize(this, null);
    executionController.initialize(this);

    middleware.initialize(this);

    this.nameSpace = executionController.nameSpace;
    this.createNamespace = executionController.createNamespace;
    this.expose = executionController.expose;
    this.use = middleware.use;
}

Samsaara.prototype.initialize = function(opts) {
    opts = opts || {};

    heart = heartbeats.createHeart(2000, 'samsaara');
    connectionController.setTransport(opts.socketType || 'ws', true);

    this.core = connectionController.newConnection(opts.socket);

    this.execute = this.core.execute.bind(this.core);
    this.executeRaw = this.core.executeRaw.bind(this.core);
    this.nameSpace = this.core.nameSpace.bind(this.core);
    this.close = this.core.close.bind(this.core);

    middleware.load();

    initializeClient(this, this.core, opts);

    return this;
};


// Initialize client instance

function initializeClient(samsaara, core, opts) {
    routeController.addRoute('INIT', initializationRouteHandler);
}


// Route Handlers

function initializationRouteHandler(connection, headerbits, incomingPacket) {
    var parsedPacket = parser.parsePacket(incomingPacket),
        connectionOwner,
        connectionRouteID,
        heartbeatInterval;

    if (typeof parsedPacket === 'object') {
        connectionOwner = parsedPacket.connectionOwner;
        connectionRouteID = parsedPacket.connectionRouteID;
        heartbeatInterval = parsedPacket.heartbeatInterval;

        helper.addReadOnlyBaseProperty(connection, 'routeID', connectionOwner);
        routeController.addRoute(connectionRouteID, executionRouteHandler);
        connection.queue.emptyToRoute(connectionOwner);
        setHeartbeats(connection, heartbeatInterval);
    }
}

function executionRouteHandler(connection, headerbits, incomingPacket) {
    var parsedPacket = parser.parsePacket(incomingPacket);

    if (parsedPacket !== undefined && parsedPacket.func !== undefined) {
        parsedPacket.sender = connection.id;
        executionController.executeFunction(connection, connection, parsedPacket);
    }
}


// Heartbeats

function setHeartbeats(connection, heartbeatInterval) {
    heart.setHeartrate(heartbeatInterval);
    heart.createEvent(1, function() {
        if (connection.outgoingPulse.missedBeats() > 0) {
            connection.socket.send('H');
        }
    });
}


module.exports = new Samsaara();
