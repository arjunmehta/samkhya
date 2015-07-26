// samsaara - client
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

    this.nameSpace = communicationController.nameSpace;
    this.createNamespace = communicationController.createNamespace;
    this.expose = communicationController.expose;
    this.use = middlewareLoader.use;
}

Samsaara.prototype.initialize = function(opts) {

    var socket;
    opts = opts || {};
    socket = opts.socket;

    middlewareLoader.load();

    this.core = connectionController.newConnection(socket);

    initializeClient(this, opts);

    return this;
};


// Initialize server instance

function initializeClient(samsaara, opts) {
    routeController.addRoute('INIT', initializationRouteHandler);
}


function initializationRouteHandler(connection, headerbits, incomingPacket) {
    var parsedPacket = parser.parsePacket(incomingPacket),
        connectionID,
        homeRoute,
        heartbeatInterval;

    if (typeof parsedPacket === 'object') {
        connectionID = parsedPacket.connectionID;
        homeRoute = parsedPacket.homeRoute;
        heartbeatInterval = parsedPacket.heartbeatInterval;

        connectionController.setHomeRoute(connection, parsedPacket.homeRoute);
        routeController.addRoute(connectionID, executionRouteHandler);
        // set up heartbeat to send on socket every X
    }
}


function executionRouteHandler(connection, headerbits, incomingPacket) {
    var parsedPacket = parser.parsePacket(incomingPacket);

    if (parsedPacket !== undefined && parsedPacket.func !== undefined) {
        parsedPacket.sender = connection.id;
        communicationController.executeFunction(connection, connection, parsedPacket);
    }
}


module.exports = new Samsaara();
