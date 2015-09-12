var routeController = require('./routeController');
var Connection = require('../constructors/connection');
var transportMediator = require('../mediator/transportMediator');

var core;
var coreID;

var connections = {};
var preInitializationMethods = [];
var initializationMethods = {};
var closingMethods = [];


var connectionController = {

    connections: connections,

    initialize: function(samsaaraCore, id) {
        core = samsaaraCore;
        coreID = id;
    },


    // Middleware

    addPreinitialization: function(method) {
        preInitializationMethods.push(method);
    },

    addInitialization: function(methodName, method, forced) {
        initializationMethods[methodName] = {
            init: method,
            forced: forced ? true : false
        };
    },

    addClosing: function(method) {
        closingMethods.push(method);
    },


    // Transport Mediation

    setTransport: function(socketType, isClient) {
        transportMediator.initialize(socketType, isClient, messageHandler, closeHandler);
    },


    // Connection Control

    connection: function(connectionID) {
        return connections[connectionID];
    },

    newConnection: function(rawSocket, name) {
        var newConnection = new Connection(rawSocket, coreID, name || null);
        var i;

        connections[newConnection.id] = newConnection;

        for (i = 0; i < preInitializationMethods.length; i++) {
            preInitializationMethods[i](newConnection);
        }

        newConnection.initializer.initialize(initializationMethods, core.opts, this.initializationDoneClosure(newConnection));
        core.emit('connected', this);

        return newConnection;
    },

    removeConnection: function(connectionID) {
        delete connections[connectionID];
    },

    initializationDoneClosure: function() {
        return function() {};
    }
};


function messageHandler(connection, incomingMessage) {
    connection.incomingPulse.beat();

    switch (incomingMessage) {
        case 'H':
            break;
        default:
            routeController.handleIncomingMessage(connection, incomingMessage);
    }
}

function closeHandler(connection, message) {
    var i;
    core.emit('disconnected', connection);

    for (i = 0; i < closingMethods.length; i++) {
        closingMethods[i](connection);
    }

    connectionController.removeConnection(connection.id);
}


module.exports = connectionController;
