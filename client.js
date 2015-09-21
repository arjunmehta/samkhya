var EventEmitter = require('events').EventEmitter;
var util = require('util');
var heartbeats = require('heartbeats');

var routeController = require('./lib/controllers/routeController');
var connectionController = require('./lib/controllers/connectionController');
var executionController = require('./lib/controllers/executionController');

var helper = require('./lib/utils/helper');
var parser = require('./lib/utils/parser');
var middleware = require('./lib/utils/middleware');

var heart;

util.inherits(Samsaara, EventEmitter);


function Samsaara() {

    EventEmitter.call(this);

    routeController.setParser(parser);
    connectionController.initialize(this, null);
    executionController.initialize(this);
    middleware.initialize(this);
}

Samsaara.prototype.nameSpace = function(namespaceName) {
    return executionController.nameSpace(namespaceName);
};

Samsaara.prototype.createNamespace = function(namespaceName, methods) {
    return executionController.createNamespace(namespaceName, methods);
};

Samsaara.prototype.expose = function(set) {
    return executionController.expose(set);
};

Samsaara.prototype.use = function(module, options) {
    return middleware.use(module, options);
};

Samsaara.prototype.setState = function(state, cb) {
    return this.core.setState(state, cb);
};

Samsaara.prototype.initialize = function(opts) {
    opts = opts || {};

    heart = heartbeats.createHeart(2000, 'samsaara');
    connectionController.setTransport(opts.socketType || 'ws', true);

    this.core = connectionController.newConnection(opts.socket, 'core');
    middleware.load();

    initializeClient(this, this.core, opts);

    return this;
};

Object.defineProperty(Samsaara.prototype, 'state', {
    get: function() {
        return this.core ? this.core.state : null;
    }
});


// Initialize client instance

function initializeClient(samsaara, core, opts) {
    routeController.addRoute('INIT', initializationRouteHandler);
    exposeStateHandler(samsaara);
}


// Route Handlers

function initializationRouteHandler(connection, headerbits, incomingPacket) {

    var parsedPacket = parser.parsePacket(incomingPacket);
    var connectionOwner;
    var connectionRouteID;
    var heartbeatInterval;

    if (typeof parsedPacket === 'object') {
        connectionOwner = parsedPacket.connectionOwner;
        connectionRouteID = parsedPacket.connectionRouteID;
        heartbeatInterval = parsedPacket.heartbeatInterval;

        helper.addReadOnlyBaseProperty(connection, 'routeID', connectionOwner);
        routeController.addRoute(connectionRouteID, executionRouteHandler);
        connection.queue.emptyToRoute(connectionOwner);
        setHeartbeats(connection, heartbeatInterval);
    }
}

function executionRouteHandler(connection, headerbits, incomingPacket) {
    var parsedPacket = parser.parsePacket(incomingPacket);

    if (parsedPacket !== undefined && parsedPacket.func !== undefined) {
        parsedPacket.sender = connection.id;
        executionController.executeFunction(connection, connection, parsedPacket);
    }
}


// State Change Handler

function exposeStateHandler(samsaara) {

    samsaara.nameSpace('internal').expose({
        setState: function(state, cb) {

            var connection = this;
            var attributeName;

            for (attributeName in state) {
                connection.state[attributeName] = state[attributeName];
            }
            samsaara.emit('stateChange', connection.state, connection);
            cb(true);
        },
        initialized: function(success, cb) {
            samsaara.emit('initialized', success);
            if (typeof cb === 'function') {
                cb(true);
            }
        }
    });
}


// Heartbeats

function setHeartbeats(connection, heartbeatInterval) {
    heart.setHeartrate(heartbeatInterval);
    heart.createEvent(1, function() {
        if (connection.outgoingPulse.missedBeats() > 0) {
            connection.socket.send('H');
        }
    });
}


module.exports = new Samsaara();
