/*!
 * Samsaara Middleware Template
 * Copyright(c) 2015 Arjun Mehta <arjun@arjunmehta.net>
 * MIT Licensed
 */


var samsaara;
var debug = require('debugit').add('samsaara:middlewareTester');


module.exports = {

    name: 'middleware_unique_name',

    initialize: function(extender, capability, options) {
        samsaara = extender.core;

        extender.addCoreObjects(this.coreObjects);
        extender.addModuleMethods(this.moduleMethods);
        extender.addExposedMethods(this.exposedMethods);
        extender.addConnectionPreInitialization(this.connectionPreInitialization);
        extender.addConnectionInitialization(this.connectionInitialization, {
            forced: true
        });
        extender.addConnectionClose(this.connectionClose);
        extender.addPreRouteFilter(this.preRouteFilter);
        extender.addMessageRoutes(this.messageRoutes);
        extender.addPreRouteFilter(this.preRouteFilter);

        return this;
    },


    // Is this something that should exist?
    // ie. samsaara.executeOnAll('someMethod')('all');

    coreObjects: {

        middlewareTestMethod: function(a) {
            return a * 2;
        },

        middlewareExecuteAll: function() {
            var connection;
            var connectionName;
            for (connectionName in samsaara.connections) {
                connection = samsaara.connections[connectionName];
                connection.execute('testMethod')('value');
            }
        }
    },


    // Adds new methods in the middleware to the module's own namespace.
    // ie. samsaara.groups.group();
    moduleMethods: {
        middlewareModuleMethod: function(a) {
            return a * 3;
        }
    },


    // Adds remotely accessible methods to samsaara's internal namespace. (Should be configurable)
    // ie. samsaara.execute('sendToGroup')
    exposedMethods: {
        middlewareRemoteMethod: function(a, cb) {
            if (cb) cb(a * 5);
        }
    },


    // Adds methods to execute when a new connection is made but not initialized yet.
    connectionPreInitialization: function(connection) {
        debug('\u001b[33mConnection Pre Initialization\u001b[0m', connection.id);
    },


    // Adds methods to execute to initialize a connection.
    connectionInitialization: function(connection, done) {
        debug('\u001b[32mConnection Initialization\u001b[0m', connection.id);
        done();
    },


    // Adds methods to execute when a connection is closed.
    connectionClose: function(connection) {

    },


    // Adds methods to execute when a new message comes in before it is routed to a method or process (ipc).
    // filter and modify the contents of a message to pass down before the message is routed.
    preRouteFilter: function(connection, headerbits, message, next) {
        debug('\u001b[31mPreRoute Filter\u001b[0m', connection.id, headerbits);
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
