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

    this.opts = {};
}

Samsaara.prototype.connection = function(connectionID) {
    return connectionController.connection(connectionID);
};

Samsaara.prototype.newConnection = function(rawSocket, opts) {
    return connectionController.newConnection(rawSocket, opts);
};

Samsaara.prototype.nameSpace = function(namespaceName) {
    return executionController.nameSpace(namespaceName);
};

Samsaara.prototype.createNamespace = function(namespaceName, methods) {
    return executionController.createNamespace(namespaceName, methods);
};

Samsaara.prototype.expose = function(set) {
    return executionController.expose(set);
};

Samsaara.prototype.use = function(module) {
    return middleware.use(module);
};

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

    connectionController.addPreinitialization(initializeConnection);

    routeController.addRoute('INIT', initializationRouteHandler);
    routeController.addRoute(coreID, executionRouteHandler);

    exposeStateHandler(samsaara);
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


// Route Handlers

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


// State Change Handler

function exposeStateHandler(samsaara) {
    samsaara.nameSpace('internal').expose({
        setState: function(state, cb) {
            var connection = this;
            var attributeName;
            for (attributeName in state) {
                connection.state[attributeName] = state[attributeName];
            }
            connection.emit('stateChange', connection.state, state);
            cb(true);
        },
        initialized: function(success) {
            this.emit('initialized', success);
        }
    });
}


// Monitor Heartbeats for connections.

function startHeartbeatMonitor() {

    heart.createEvent(3, function() {
        var connections = connectionController.connections;
        var connection;
        var connectionID;

        for (connectionID in connections) {
            connection = connections[connectionID];

            if (connection.incomingPulse.missedBeats() > 2) {
                connection.close(111, 'Flatlining Connection');
            }
        }
    });
}


module.exports = new Samsaara();
