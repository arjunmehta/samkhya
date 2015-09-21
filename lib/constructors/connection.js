var EventEmitter = require('events').EventEmitter;
var util = require('util');

var uuid = require('uuid');
var heartbeats = require('heartbeats');

var executionController = require('../controllers/executionController');
var ConnectionInitializer = require('./connectionInitializer');
var ConnectionQueue = require('./connectionQueue');
var transportMediator = require('../mediator/transportMediator');

var addReadOnlyBaseProperty = require('../utils/helper').addReadOnlyBaseProperty;

util.inherits(Connection, EventEmitter);


function Connection(socket, owner, name, nameChangeHandler) {

    var _state = {};
    var _name;

    EventEmitter.call(this);

    addReadOnlyBaseProperty(this, 'socket', transportMediator.mediateSocket(socket, this));
    addReadOnlyBaseProperty(this, 'id', uuid.v4());
    addReadOnlyBaseProperty(this, 'owner', owner);
    addReadOnlyBaseProperty(this, 'incomingPulse', heartbeats.heart('samsaara').newPulse());
    addReadOnlyBaseProperty(this, 'outgoingPulse', heartbeats.heart('samsaara').newPulse());
    addReadOnlyBaseProperty(this, 'initializer', new ConnectionInitializer(this));
    addReadOnlyBaseProperty(this, 'queue', new ConnectionQueue(this));

    if (owner) {
        addReadOnlyBaseProperty(this, 'routeID', this.id.slice(0, 8));
    }

    Object.defineProperty(this, 'name', {
        get: function() {
            return _name;
        },
        set: function(newName) {
            nameChangeHandler(this, _name, newName);
            _name = newName;
        }
    });

    Object.defineProperty(this, 'state', {
        get: function() {
            return _state;
        }
    });

    this.name = name;
}

Object.defineProperty(Connection.prototype, 'initialized', {
    get: function() {
        return this.initializer.initialized;
    }
});

// Method to update state attribute on the connection. This method should be used when updating
// the connection with new data, as it can be middlewared to broadcast changes, etc.
Connection.prototype.setState = function(state, sync) {

    var attributeName;

    for (attributeName in state) {
        this.state[attributeName] = state[attributeName];
    }

    if (sync) {
        this.nameSpace('internal').execute('setState')(state);
    }
};

// returns a namespace object that returns an execute method with the namespace as a closure..
Connection.prototype.nameSpace = function(namespaceName) {

    var connection = this;

    return {
        execute: function(funcName) {
            return function() {
                evalExecute(connection, connection.socket, [connection.id], namespaceName, funcName, arguments);
            };
        }
    };
};

// Method to execute methods on the client.
Connection.prototype.execute = function(funcName, namespaceName) {
    var connection = this;
    namespaceName = namespaceName || 'core';

    return function() {
        evalExecute(connection, connection.socket, [connection.id], namespaceName, funcName, arguments);
    };
};

// Method to execute on the client with a raw (pre processed) packet.
Connection.prototype.executeRaw = function(packet, cb) {
    evalExecuteRaw(this, this.socket, [this.id], packet, cb);
};

// Method to close the connection socket.
Connection.prototype.close = function(code, message) {
    this.socket.close(code, message);
};


function evalExecute(connection, channel, executorArray, namespaceName, funcName, args) {
    if (connection.routeID) {
        executionController.execute(channel, connection.routeID, executorArray, namespaceName, funcName, args);
    } else {
        connection.queue.add(channel, executorArray, namespaceName, funcName, args);
    }
}

function evalExecuteRaw(connection, channel, executorArray, packet, cb) {
    if (connection.routeID) {
        executionController.executeRaw(channel, connection.routeID, executorArray, packet, cb);
    } else {
        connection.queue.addRaw(channel, executorArray, packet, cb);
    }
}


module.exports = Connection;
