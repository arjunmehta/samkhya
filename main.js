// samsaara
// Copyright(c) 2013-2015 Arjun Mehta <arjun@arjunmehta.net>
// MIT Licensed


var EventEmitter = require('events').EventEmitter;
var util = require('util');
var heartbeats = require('heartbeats');

var helper = require('./utils/helper');
var parser = require('./lib/parser');

var routeController = require('./lib/routeController'),
    connectionController = require('./lib/connectionController'),
    communicationController = require('./lib/communicationController'),
    middlewareLoader = require('./lib/middlewareLoader'),
    transportMediator = require('./transportMediator');

var Connection = require('./lib/connection'),
    NameSpace = require('./lib/namespace'),
    IncomingCallBack = require('./lib/callback');

var coreID = helper.createPseudoUuid(8),
    heart,
    heartbeatInterval;

util.inherits(Samsaara, EventEmitter);


function Samsaara() {

    EventEmitter.call(this);

    routeController.initialize(parser);
    connectionController.initialize(coreID);
    communicationController.initialize(coreID, this, connectionController);
    middlewareLoader.initialize(this, connectionController, communicationController, routeController);

    Connection.initialize(coreID, this, communicationController, connectionController, routeController);
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

    opts = opts || {};
    this.opts = opts;

    connectionController.setTransport(opts.socketType || 'ws', false);

    heartbeatInterval = opts.heartbeatInterval || 10000;
    heart = heartbeats.createHeart(heartbeatInterval, 'samsaara');

    middlewareLoader.load();
    initializeServer(this, opts);

    return this;
};


// Initialize server instance

function initializeServer(samsaara, opts) {

    Connection.preInitializationMethods.push(initializeConnection);
    routeController.addRoute('INIT', initializationRouteHandler);
    routeController.addRoute(coreID, executionRouteHandler);
    startHeartbeatMonitor();
}


// Add a method to execute when new Connection is made.

function initializeConnection(connection) {

    routeController.routePacket(connection.socket, 'INIT', {
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
        communicationController.executeFunction(connection, connection, parsedPacket);
    }
}

function startHeartbeatMonitor() {
    heart.createEvent(3, function() {
        var connections = connectionController.connections,
            connection,
            connectionID;

        for (connectionID in connections) {
            connection = connections[connectionID];

            if (connection.incomingPulse.missedBeats() > 2) {
                connection.socket.close(111, 'Flatlining Connection');
            }
        }
    });
}


module.exports = new Samsaara();
