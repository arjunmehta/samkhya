var heartbeats = require('heartbeats');

var samsaaraID;
var Connection = require('./constructors/connection').Constructor;


function ConnectionController(uuid) {

    samsaaraID = uuid;

    this.connections = {};
    this.heartBeatThreshold = 11000;
    this.heart = heartbeats.createHeart(this.heartBeatThreshold, 'global');
    this.clearConnectionsInterval = setInterval(this.checkForDeadConnections, this.heartBeatThreshold * 2.5);
}

ConnectionController.prototype.connection = function(connectionID) {
    return this.connections[connectionID];
};

ConnectionController.prototype.newConnection = function(rawConnection) {
    var newSamsaaraConnection = new Connection(rawConnection);
    this.connections[newSamsaaraConnection.id] = newSamsaaraConnection;

    return newSamsaaraConnection;
};

ConnectionController.prototype.removeConnection = function(connectionID) {
    delete this.connections[connectionID];
};

// Method to handle new socket messages.

ConnectionController.prototype.messageHandler = function(connection, rawMessage) {
    rawMessage = rawMessage.data || rawMessage;
    connection.incomingPulse.beat();

    switch (rawMessage) {
        case 'H':
            break;
        default:
            routeController.newIncomingMessage(connection, rawMessage);
    }
};

// Connection close handler.
// Executed when the socket closes

ConnectionController.prototype.closeHandler = function(connection, message) {
    var i;

    core.emit('disconnected', connection);

    for (i = 0; i < closingMethods.length; i++) {
        closingMethods[i](connection);
    }

    this.removeConnection(connection.id);
};


ConnectionController.prototype.initializeConnection = function(connection, opts) {

    var ia = this.initializeAttributes;
    var moduleName;

    opts = opts || {};

    if (Object.keys(initializationMethods).length > 0) {
        for (moduleName in initializationMethods) {
            initializationMethods[moduleName](opts, connection, buildInitializedClosure(this, moduleName));
        }

        for (moduleName in initializationMethods) {
            if (initializationMethods[moduleName].forced === true) {
                ia.forced[moduleName] = false;
            }
        }

    } else {
        this.completeInitialization();
    }

    ia.ready = true;
};


function buildInitializedClosure(connection, moduleName) {
    return function() {
        connection.completedInitializationOf(moduleName);
    };
}


Connection.prototype.completedInitializationOf = function(moduleName) {
    this.ia.initialize(moduleName);
};


// Method to finish the initialization process.

Connection.prototype.completeInitialization = function() {

    if (this.initialized === false) {

        this.initialized = true;

        this.executeRaw({
            ns: 'internal',
            func: 'samsaaraInitialized',
            args: [true]
        }, function(confirmation) {
            core.emit('initialized', this);
        });
    }
};


// A special object that manages the initialization of various attributes of the connection.

function InitializedAttributes(connection) {

    this.connection = connection;
    this.forced = {};
    this.ready = false;
}


InitializedAttributes.prototype.initialized = function(attribute) {


    if (this.forced[attribute] !== undefined) {

        this.forced[attribute] = true;

        if (this.allInitialized() === true) {
            this.connection.completeInitialization();
        }
    }
};

InitializedAttributes.prototype.allInitialized = function() {

    var forced = this.forced;
    var attr;

    if (this.ready) {
        for (attr in forced) {
            if (forced[attr] === false) return false;
        }
    }
    return true;
};







module.exports = function(uuid) {
    return new ConnectionController(uuid);
};
