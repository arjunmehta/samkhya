var debug = require('debug')('samsaara:router');
var debugError = require('debug')('samsaara:router:error');

var core, samsaara;

var router = {};

var communication;
var preRouteFilters, messageRoutes;


function initialize(samsaaraCore) {

    core = samsaaraCore;
    samsaara = samsaaraCore.samsaara;

    communication = samsaaraCore.communication;

    preRouteFilters = router.preRouteFilters = [];

    messageRoutes = router.messageRoutes = {
        OWN: localExecutionRoute,
        INIT: initializeRoute
    };

    return router;
}

function Router(samsaara) {
    this.core = samsaara;
}

Router.prototype.routes = {

    OWN: function(connection, headerbits, incoming_packet) {

        var parsed_packet = parseJSON(incoming_packet);

        if (parsed_packet !== undefined && parsed_packet.func !== undefined) {
            parsed_packet.sender = connection.id;
            communication.executeFunction(connection, connection, parsed_packet);
        }
    },

    INIT: function(connection, headerbits, incoming_packet) {
        var parsed_packet = parseJSON(incoming_packet);

        if (parsed_packet !== undefined && parsed_packet.opts !== undefined) {
            debug("Connection Options", parsed_packet.opts);
            connection.initialize(parsed_packet.opts);
        }
    }
};

Router.prototype.newConnectionMessage = function(connection, message) {

    debug("New Connection Message", connection.id, message);

    var self = this;
    var i = 0;
    var splitIndex = message.indexOf("::");
    var headerbits = message.substr(0, splitIndex).split(":");

    message = message.slice(2 + splitIndex - message.length);

    next();

    function next(err) {
        if (err !== undefined) {
            debugError("Message Acceptance Error:", err);
        } else if (preRouteFilters.length > i) {
            preRouteFilters[i++](connection, headerbits, message, next);
        } else {
            self.route(connection, headerbits, message);
        }
    }
};


// compare the first value in the header to what might exist in the messageRoutes object.

Router.prototype.route = function(connection, headerbits, message) {
    if (messageRoutes[headerbits[0]]) {
        messageRoutes[headerbits[0]](connection, headerbits, message);
    }
};




function parseJSON(jsonString) {
    var parsed;

    try {
        parsed = JSON.parse(jsonString);
    } catch (e) {
        debug("Message Error: Invalid JSON", jsonString, e);
    }

    return parsed;
}


exports = module.exports = {
    initialize: initialize
};
