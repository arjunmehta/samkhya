var parser;
var routes = {};
var preRouteFilters = [];


var routeController = {

    initialize: function(coreParser) {
        parser = coreParser;
    },

    addRoute: function(routeName, routeHandler) {
        routes[routeName] = routeHandler;
    },

    removeRoute: function(routeName) {
        if (routes[routeName] !== undefined) {
            routes[routeName] = undefined;
        }
    },


    // Incoming

    handleIncomingMessage: function(connection, incomingMessage) {
        var parsed = parser.splitPacket(incomingMessage);
        processIncomingMessage(connection, parsed.headerbits, parsed.message);
    },


    // Outgoing

    routePacket: function(channel, route, packet) {
        var stringifiedPacket = parser.stringifyPacket(packet);
        var outgoingMessage = parser.addHeadersToPacket([route], stringifiedPacket);
        channel.send(outgoingMessage);
    }
};


function processIncomingMessage(connection, headerbits, incomingMessage) {
    var i = 0;
    next();

    function next(err) {
        if (err !== undefined) {
            console.error('Message Acceptance Error:', err);
        } else if (preRouteFilters.length > i) {
            preRouteFilters[i++](connection, headerbits, incomingMessage, next);
        } else {
            routeIncomingMessage(connection, headerbits, incomingMessage);
        }
    }
}

function routeIncomingMessage(connection, headerbits, incomingMessage) {
    if (routes[headerbits[0]] !== undefined) {
        routes[headerbits[0]](connection, headerbits, incomingMessage);
    } else {
        console.error('Invalid Route:', headerbits[0], 'by connection', connection.id);
    }
}


module.exports = routeController;
