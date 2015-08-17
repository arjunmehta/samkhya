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
        initializationMethods[methodName].init = method;
        initializationMethods[methodName].forced = forced ? true : false;
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

    newConnection: function(rawSocket, opts) {
        var i,
            newConnection = new Connection(rawSocket, coreID, opts);

        connections[newConnection.id] = newConnection;

        for (i = 0; i < preInitializationMethods.length; i++) {
            preInitializationMethods[i](newConnection);
        }

        newConnection.inititializer.initialize(initializationMethods, core.opts, initializationDoneClosure(newConnection));
        core.emit('connected', this);

        return newConnection;
    },

    removeConnection: function(connectionID) {
        delete connections[connectionID];
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

    this.removeConnection(connection.id);
}


function initializationDoneClosure(connection) {
    return function() {
        connection.execute('initialized', 'internal')(true, function(confirmation) {
            core.emit('initialized', connection);
        });
    };
}


module.exports = connectionController;
