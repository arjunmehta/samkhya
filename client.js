// samsaara - client
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
    connectionController.initialize(coreID);
    communicationController.initialize(coreID, this, connectionController);
    middlewareLoader.initialize(this, connectionController, communicationController, routeController);

    Connection.initialize(coreID, this, communicationController, connectionController, routeController);
    NameSpace.initialize(this);
    IncomingCallBack.initialize(this, communicationController);

    this.nameSpace = communicationController.nameSpace;
    this.createNamespace = communicationController.createNamespace;
    this.expose = communicationController.expose;
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
        communicationController.executeFunction(connection, connection, parsedPacket);
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
