// samsaara
// Copyright(c) 2013-2015 Arjun Mehta <arjun@arjunmehta.net>
// MIT Licensed


var EventEmitter = require('events').EventEmitter;
var util = require('util');

var pseudoUuid = require('utils/helper').createPseudoUuid(8);

var connectionController,
    communicationController,
    routeController,
    middlewareLoader;

var Connection = require('./lib/connection'),
    NameSpace = require('./lib/namespace'),
    IncomingCallBack = require('./lib/callback');

var parser = require('./lib/parser');


util.inherits(Samsaara, EventEmitter);


function Samsaara() {

    EventEmitter.call(this);

    routeController = require('./lib/routeController')(parser);
    connectionController = require('./lib/connectionController')(pseudoUuid);
    communicationController = require('./lib/communicationController')(pseudoUuid, this, connectionController);
    middlewareLoader = require('./lib/middlewareLoader')(this, connectionController, communicationController, routeController);

    Connection.initialize(pseudoUuid, this, communicationController, connectionController, routeController);
    NameSpace.initialize(this);
    IncomingCallBack.initialize(this, communicationController);

    this.connection = connectionController.connection;
    this.newConnection = connectionController.newConnection;
    this.nameSpace = communicationController.nameSpace;
    this.createNamespace = communicationController.createNamespace;
    this.expose = communicationController.expose;
    this.use = middlewareLoader.use;

    this.opts = {};
}

Samsaara.prototype.initialize = function(opts) {
    this.opts = opts || {};
    middlewareLoader.load();
    initializeServer(this, opts);

    return this;
};


// Initialize server instance

function initializeServer(samsaara, opts) {
    Connection.preInitializationMethods.push(initializeConnection);
    routeController.addRoute('INIT', initializationRouteHandler);
    routeController.addRoute(pseudoUuid, executionRouteHandler);
    // Set up heartbeat check for dead connections here
}


// Add a method to execute when new Connection is made.

function initializeConnection(connection) {
    routeController.routePacket(connection.socket, 'INIT', {
        connectionOwner: connection.owner,
        connectionRouteID: connection.routeID,
        heartbeatInterval: connectionController.heartbeatInterval
    });
}


// Local route handlers

function initializationRouteHandler(connection, headerbits, incomingPacket) {
    var parsedPacket = parser.parsePacket(incomingPacket);

    if (parsedPacket !== undefined && parsedPacket.opts !== undefined) {
        connectionController.initializeConnection(connection, parsedPacket.opts);
        // connection.initialize(parsedPacket.opts);
    }
}

function executionRouteHandler(connection, headerbits, incomingPacket) {
    var parsedPacket = parser.parsePacket(incomingPacket);

    if (parsedPacket !== undefined && parsedPacket.func !== undefined) {
        parsedPacket.sender = connection.id;
        communicationController.executeFunction(connection, connection, parsedPacket);
    }
}

ConnectionController.prototype.checkForDeadConnections = function() {

    var threshold = Math.floor(25000 / 10000),
        connections = this.connections,
        connection,
        connectionID;

    for (connectionID in connections) {

        connection = connections[connectionID];

        if (connection.owner === samsaaraID && connection.pulse.missedBeats() > threshold) {
            connection.conn.close(111, 'Flatlining Connection');
        }
    }
};


module.exports = new Samsaara();
