var parser;
var preRouteFilters = [];
var headerList = {};


function RouteController(coreParser) {
    parser = coreParser;
    this.routes = {};
}

RouteController.prototype.addRoute = function(routeName, routeHandler) {
    this.routes[routeName] = routeHandler;
};

RouteController.prototype.addRoutes = function(routes) {
    var routeName;
    for (routeName in routes) {
        this.addRoute(routeName, routes[routeName]);
    }
};

RouteController.prototype.removeRoute = function(routeName) {
    if (this.routes[routeName] !== undefined) {
        this.routes[routeName] = undefined;
    }
};

// Incoming Handlers
// These messages have a header, and a route, as well as a stringified JSON packet

RouteController.prototype.newIncomingMessage = function(connection, incomingMessage) {
    var parsed = parser.splitPacket(incomingMessage);
    this.processIncomingMessage(connection, parsed.headerbits, parsed.message);
};

RouteController.prototype.processIncomingMessage = function(connection, headerbits, incomingMessage) {
    var self = this;
    var i = 0;

    next();

    function next(err) {
        if (err !== undefined) {
            console.error('Message Acceptance Error:', err);
        } else if (preRouteFilters.length > i) {
            preRouteFilters[i++](connection, headerbits, incomingMessage, next);
        } else {
            self.routeIncomingMessage(connection, headerbits, incomingMessage);
        }
    }
};

RouteController.prototype.routeIncomingMessage = function(connection, headerbits, incomingMessage) {
    if (this.routes[headerbits[0]] !== undefined) {
        this.routes[headerbits[0]](connection, headerbits, incomingMessage);
    } else {
        console.error('Invalid Route:', headerbits[0], 'by connection', connection.id);
    }
};


// Outgoing Handlers

RouteController.prototype.routePacket = function(channel, route, packet) {
    var stringifiedPacket = parser.stringifyPacket(packet);
    var rawPacket = parser.addHeadersToPacket([route], stringifiedPacket);
    channel.send(rawPacket);
};


module.exports = function(coreParser) {
    return new RouteController(coreParser);
};
