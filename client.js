var EventEmitter = require('events').EventEmitter;
var util = require('util');
var heartbeats = require('heartbeats');

var helper = require('./utils/helper');
var parser = require('./lib/parser');

var routeController = require('./lib/routeController'),
    connectionController = require('./lib/connectionController'),
    executionController = require('./lib/executionController'),
    middlewareLoader = require('./lib/middlewareLoader');

var Connection = require('./lib/connection'),
    NameSpace = require('./lib/namespace'),
    IncomingCallBack = require('./lib/callback');

var coreID = helper.createPseudoUuid(8),
    heart;


util.inherits(Samsaara, EventEmitter);


function Samsaara() {

    EventEmitter.call(this);

    routeController.initialize(parser);
    connectionController.initialize(coreID, this);
    executionController.initialize(this, routeController);
    middlewareLoader.initialize(this, connectionController, executionController, routeController);

    Connection.initialize(coreID, this, executionController, connectionController, routeController);
    NameSpace.initialize();
    IncomingCallBack.initialize(executionController);

    this.nameSpace = executionController.nameSpace;
    this.createNamespace = executionController.createNamespace;
    this.expose = executionController.expose;
    this.use = middlewareLoader.use;
}

Samsaara.prototype.initialize = function(opts) {

    var socket;
    opts = opts || {};
    socket = opts.socket;

    connectionController.setTransport(opts.socketType || 'ws', false);
    heart = heartbeats.createHeart(2000, 'samsaara');

    middlewareLoader.load();
    this.core = connectionController.newConnection(socket);
    initializeClient(this, this.core, opts);

    return this;
};


// Initialize server instance

function initializeClient(samsaara, core, opts) {
    routeController.addRoute('INIT', initializationRouteHandler);
}


// Initialization Methods

function initializationRouteHandler(connection, headerbits, incomingPacket) {
    var parsedPacket = parser.parsePacket(incomingPacket),
        connectionOwner,
        connectionRouteID,
        heartbeatInterval;

    if (typeof parsedPacket === 'object') {
        connectionOwner = parsedPacket.connectionOwner;
        connectionRouteID = parsedPacket.connectionRouteID;
        heartbeatInterval = parsedPacket.heartbeatInterval;

        connectionController.setRouteID(connection, connectionOwner);
        routeController.addRoute(connectionRouteID, executionRouteHandler);
        setHeartrate(connection, heartbeatInterval);
    }
}

function executionRouteHandler(connection, headerbits, incomingPacket) {
    var parsedPacket = parser.parsePacket(incomingPacket);

    if (parsedPacket !== undefined && parsedPacket.func !== undefined) {
        parsedPacket.sender = connection.id;
        executionController.executeFunction(connection, connection, parsedPacket);
    }
}

function setHeartrate(connection, heartbeatInterval) {
    heart.setHeartrate(heartbeatInterval);
    heart.createEvent(1, function() {
        if (connection.outgoingPulse.missedBeats() > 0) {
            connection.socket.send('H');
        }
    });
}


module.exports = new Samsaara();
