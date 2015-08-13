var Connection = require('./constructors/connection').Constructor;
var routeController = require('./routeController');
var transportMediator = require('./transportMediator');

var connections = {};
var core,
    coreID;

var preInitializationMethods = [],
    initializationMethods = {},
    closingMethods = [];


var connectionController = {

    connections: connections,

    initialize: function(pseudoID, samsaaraCore) {
        core = samsaaraCore;
        coreID = pseudoID;
    },


    // Middleware Load

    addInitialization: function(methodName, method, forced) {
        initializationMethods[methodName].init = method;
        initializationMethods[methodName].forced = forced ? true : false;
    },

    addPreinitialization: function(method) {
        preInitializationMethods.push(method);
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

        newConnection.inititializer.initialize(initializationMethods, core.opts, initializedClosure(newConnection));
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


function initializedClosure(connection) {
    return function() {
        connection.execute('initialized', 'internal')(true, function(confirmation) {
            core.emit('initialized', connection);
        });
    };
}


module.exports = connectionController;
