/*!
 * Samsaara Middleware Template
 * Copyright(c) 2015 Arjun Mehta <arjun@arjunmehta.net>
 * MIT Licensed
 */


var debug = require('debug')('samsaara:groups:main');
var samsaara;


module.exports = exports = {

    name: "middleware_unique_name",
    init_required: true,

    initialize: function(samsaara_core) {
        samsaara = samsaara_core;
        return this;
    },

    // adds methods on the main samsaara object. Do not use
    coreMethods: {
        middlewareTestMethod: function(a) {
            return a * 2;
        }
    },

    // Methods available to be executed locally on the module's own samsaara property.
    moduleMethods: {
        middlewareModuleMethod: function() {
            return a * 3;
        }
    },

    // Methods available to be executed remotely on the "internal" namespace
    remoteMethods: {
        middlewareRemoteMethod: function(a, cb) {
            if (cb) cb(a * 5);
        }
    },


    //
    connectionPreInitialization: function(connection) {

    },

    connectionInitialization: function(connection_options, connection, done) {},

    connectionClose: function(connection) {},

    // filter and modify the contents of a message to pass down before the message is routed.
    preRouteFilter: function(connection, headerbits, message, next) {
        next();
    },

    // if the very first chunk of the header matches any one of these it will route the message here.
    // takes the samsaara connection, parsed header bits, and the actual unparsed message
    messageRoutes: {
        RTE: function(connection, headerbits, message) {

        }
    },

    finalize: function() {}
};


// the root interface loaded by require. Options are pass in options here.

function main(opts) {
    return initialize;
}


// samsaara will call this method when it's ready to load it into its middleware stack
// return your main

function initialize(samsaaraCore) {

    connectionController = samsaaraCore.connectionController;
    communication = samsaaraCore.communication;
    ipc = samsaaraCore.ipc;

    LocalGroup = require('./localgroup').initialize(samsaaraCore, groups);
    GlobalGroup = require('./globalgroup').initialize(samsaaraCore, groups);

    if (samsaaraCore.capability.ipc === true) {
        createGroup = groupController.main.createGroup = createGlobalGroup;
    } else {
        createGroup = groupController.main.createGroup = createLocalGroup;
    }
    createGroup("everyone");

    samsaaraCore.addClientFileRoute("samsaara-groups.js", __dirname + '/client/samsaara-groups.js');

    groupController.constructors = {
        LocalGroup: LocalGroup,
        GlobalGroup: GlobalGroup
    };

    return groupController;
}


// Foundation Methods

function group(groupName) {
    return groups[groupName];
}


function createLocalGroup(groupName, memberArray) {
    if (groups[groupName] === undefined) {
        groups[groupName] = new LocalGroup(groupName, memberArray);
    }

    return groups[groupName];
}


function createGlobalGroup(groupName, memberArray, callBack) {

    // need to consider ipc here.

    if (groups[groupName] === undefined) {
        groups[groupName] = new GlobalGroup(groupName, memberArray); // new Group(groupName)
        if (typeof callBack === "function") callBack(null, true);
    } else {
        if (typeof callBack === "function") callBack(new Error("Group Already Exists"), false);
    }
}


/**
 * Connection Initialization Methods
 * Called for every new connection
 *
 * @opts: {Object} contains the connection's options
 * @connection: {SamsaaraConnection} the connection that is initializing
 * @attributes: {Attributes} The attributes of the SamsaaraConnection and its methods
 */

function connectionInitialization(opts, connection, attributes) {

    connection.groups = {};
    var connectionGroups = opts.groups || [];

    debug("Initializing Grouping.....!!!", connectionGroups, connection.id);

    attributes.force("groups");
    connectionGroups.push('everyone');

    var groupsAdded = {};
    for (var i = 0; i < connectionGroups.length; i++) {
        groupsAdded[connectionGroups[i]] = group(connectionGroups[i]).add(connection);
    }
    debug("Initialization Add to Groups", groupsAdded);

    attributes.initialized(null, "groups");
}


function connectionClosing(connection) {
    var connID = connection.id;

    if (connection.groups) {
        debug("Disconnecting Client", connID, connection.groups);
        for (var groupName in connection.groups) {
            group(groupName).remove(connection);
        }
    }
}
