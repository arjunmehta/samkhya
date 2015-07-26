/*!
 * Samsaara Middleware Template
 * Copyright(c) 2015 Arjun Mehta <arjun@arjunmehta.net>
 * MIT Licensed
 */


var debug = require('debug')('samsaara:groups:main');
var samsaara;

module.exports = {

    name: 'middleware_unique_name',
    init_required: true,

    initialize: function(samsaaraExtender) {

        samsaara = samsaaraExtender.samsaara_core;

        samsaaraExtender.setCoreMethods(this.coreMethods);
        samsaaraExtender.setModuleMethods(this.moduleMethods);
        samsaaraExtender.setExposedMethods(this.remoteMethods);
        samsaaraExtender.setConnectionPreInitialization(this.connectionPreInitialization);
        samsaaraExtender.setConnectionInitialization(this.connectionInitialization);
        samsaaraExtender.setConnectionClose(this.connectionClose);
        samsaaraExtender.setPreRouteFilter(this.preRouteFilter);
        samsaaraExtender.setPreRouteFilter(this.preRouteFilter);
        samsaaraExtender.setMessageRoutes(this.messageRoutes);
        samsaaraExtender.setPreRouteFilter(this.preRouteFilter);
        this.finalize(samsaaraExtender);

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
        middlewareModuleMethod: function(a) {
            return a * 3;
        }
    },

    // Methods available to be executed remotely on the 'internal' namespace
    remoteMethods: {
        middlewareRemoteMethod: function(a, cb) {
            if (cb) cb(a * 5);
        }
    },


    //
    connectionPreInitialization: function(connection) {

    },

    connectionInitialization: function(connectionOptions, connection, done) {},

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


