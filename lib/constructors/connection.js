/*!
 * samsaaraSocks - Connection Constructor
 * Copyright(c) 2013 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */


var heartbeats = require('heartbeats');

var samsaara_id,
    core,
    communicationController,
    routeController,
    connectionController;

var preInitializationMethods = [],
    initializationMethods = {},
    closingMethods = [];


function initialize(uuid, samsaara_core, communication_controller, connection_controller, route_controller) {

    samsaara_id = uuid;
    core = samsaara_core;
    communicationController = communication_controller;
    connectionController = connection_controller;
    routeController = route_controller;    

    return Connection;
}


function Connection(conn) {

    var self = this;

    this.id = conn.id; // transport specific, instead generate a new uuid
    this.conn = conn;
    this.owner = samsaara_id;

    this.initializeAttributes = new InitializedAttributes(this);
    this.initialized = false;
    this.pulse = heartbeats.heart('global').newPulse();

    this.connectionData = {};

    if (!conn.send && conn.write) {
        conn.send = conn.write;
    }

    for (var i = 0; i < preInitializationMethods.length; i++) {
        preInitializationMethods[i](self);
    }

    conn.on('close', function(message) {
        self.closeConnection(message);
    });

    conn.on('data', function(message) {
        self.handleMessage(message);
    });

    conn.send(JSON.stringify(['INIT', {
        samsaaraID: self.id,
        samsaaraOwner: self.owner,
        samsaaraHeartBeat: communicationController.heartBeatThreshold
    }]));

    core.emit('connected', this);
}



// Method to update connectionData attribute on the connection. This method should be used when updating
// the connection with new data, as it can be middlewared to broadcast changes, etc.

Connection.prototype.updateDataAttribute = function(attributeName, value) {
    this.connectionData[attributeName] = value;
};


// Method to handle new socket messages.

Connection.prototype.handleMessage = function(raw_message) {

    this.pulse.beat();

    switch (raw_message) {
        case 'H':
            break;
        default:
            routeController.newConnectionMessage(this, raw_message);
    }
};



// creates a namespace object that holds an execute method with the namespace as a closure..

Connection.prototype.nameSpace = function(nameSpaceName) {

    var connection = this;

    return {
        execute: function execute() {

            var packet = {
                ns: nameSpaceName,
                func: arguments[0],
                args: []
            };

            communicationController.execute(connection, packet, arguments);
        }
    };
};


// Method to execute methods on the client.

Connection.prototype.execute = function() {

    var packet = {
        func: arguments[0],
        args: []
    };

    communicationController.execute(this, packet, arguments);
};


// Method to execute on the client with a raw (pre processed) packet.

Connection.prototype.executeRaw = function(packet, callback) {
    communicationController.executeRaw(this, packet, callBack);
};


// Method to send new raw socket messages.

Connection.prototype.send = function(message) {
    this.conn.send(message);
};


// Connection close handler.

Connection.prototype.closeConnection = function(message) {

    core.emit('disconnected', this);

    for (var i = 0; i < closingMethods.length; i++) {
        closingMethods[i](this);
    }

    if (typeof this.conn.removeAllListeners === 'function') {
        this.conn.removeAllListeners();
    }

    connectionController.removeConnection(this.id);
};


// Method to start the initialization process. Executed from the routeController, when the opts message is received.

Connection.prototype.initialize = function(opts) {


    opts = opts || {};

    var connection = this;
    var ia = this.initializeAttributes;
    var module_name;

    if (Object.keys(initializationMethods).length > 0) {
        for (module_name in initializationMethods) {
            initializationMethods[module_name].init(opts, connection, buildinitializedClosure(module_name));
        }

        for (module_name in initializationMethods) {
            if (initializationMethods[module_name].forced === true) {
                ia.forced[module_name] = false;
            }
        }

    } else {
        this.completeInitialization();
    }

    ia.ready = true;
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

    if (this.ready) {

        for (var attr in forced) {
            if (forced[attr] === false) return false;
        }
    }
    return true;
};



module.exports = {

    initialize: initialize,

    preInitializationMethods: preInitializationMethods,
    initializationMethods: initializationMethods,
    closingMethods: closingMethods,

    Constructor: Connection,
    InitializedAttributes: InitializedAttributes
};
