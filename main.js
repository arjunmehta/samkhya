var EventEmitter = require('events').EventEmitter;
var util = require('util');
var heartbeats = require('heartbeats');

var routeController = require('./lib/controllers/routeController');
var connectionController = require('./lib/controllers/connectionController');
var executionController = require('./lib/controllers/executionController');

var helper = require('./lib/utils/helper');
var parser = require('./lib/utils/parser');
var middleware = require('./lib/utils/middleware');

var coreID = helper.createPseudoUuid(8);
var heart;
var heartbeatInterval;

util.inherits(Samsaara, EventEmitter);


function Samsaara() {

    EventEmitter.call(this);

    routeController.setParser(parser);
    connectionController.initialize(this, coreID);
    executionController.initialize(this);

    middleware.initialize(this);

    this.connection = connectionController.connection;
    this.newConnection = connectionController.newConnection;
    this.nameSpace = executionController.nameSpace;
    this.createNamespace = executionController.createNamespace;
    this.expose = executionController.expose;
    this.use = middleware.use;

    this.opts = {};
}

Samsaara.prototype.initialize = function(opts) {
    opts = opts || {};
    this.opts = opts;

    connectionController.setTransport(opts.socketType || 'ws', false);

    heartbeatInterval = opts.heartbeatInterval || 10000;
    heart = heartbeats.createHeart(heartbeatInterval, 'samsaara');

    middleware.load();
    initializeServer(this, opts);

    return this;
};


// Initialize server instance

function initializeServer(samsaara, opts) {
    connectionController.addPreInitialization(initializeConnection);
    routeController.addRoute('INIT', initializationRouteHandler);
    routeController.addRoute(coreID, executionRouteHandler);
    startHeartbeatMonitor();
}


// Add a method to execute when new Connection is made.

function initializeConnection(connection) {
    routeController.routeOutgoingPacket(connection.socket, 'INIT', {
        connectionOwner: connection.owner,
        connectionRouteID: connection.routeID,
        heartbeatInterval: heartbeatInterval
    });
}


// Local route handlers

function initializationRouteHandler(connection, headerbits, incomingPacket) {

    var parsedPacket = parser.parsePacket(incomingPacket);

    if (parsedPacket !== undefined && parsedPacket.opts !== undefined) {
        connectionController.initializeConnection(connection, parsedPacket.opts);
    }
}

function executionRouteHandler(connection, headerbits, incomingPacket) {

    var parsedPacket = parser.parsePacket(incomingPacket);

    if (parsedPacket !== undefined && parsedPacket.func !== undefined) {
        parsedPacket.sender = connection.id;
        executionController.executeFunction(connection, connection, parsedPacket);
    }
}


// Monitor Heartbeats for connections.

function startHeartbeatMonitor() {

    heart.createEvent(3, function() {
        var connections = connectionController.connections,
            connection,
            connectionID;

        for (connectionID in connections) {
            connection = connections[connectionID];

            if (connection.incomingPulse.missedBeats() > 2) {
                connection.close(111, 'Flatlining Connection');
            }
        }
    });
}


module.exports = new Samsaara();
