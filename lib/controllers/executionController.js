var IncomingCallBack = require('../constructors/callback').Constructor,
    NameSpace = require('../constructors/namespace').Constructor;

var core,
    routeController;

var incomingCallbacks = {},
    outgoingCallBacks = {},
    nameSpaces = {};

var executionController = {

    initialize: function(samsaaraCore, routeCtrl) {
        core = samsaaraCore;
        routeController = routeCtrl;

        this.createNamespace('core', {});
        this.createNamespace('internal', {
            callItBack: this.callItBack,
            callItBackError: this.callItBackError
        });
    },


    // Outgoing Execution

    execute: function(channel, route, executorArray, namespaceName, funcName, args) {

        var packet = {
            func: funcName,
            ns: namespaceName || 'core',
            args: args
        };

        if (typeof args[args.length - 1] === 'function') {
            packet.args = Array.slice(args);
            this.createCallBack(packet.args.pop(), executorArray, packet);
        }

        routeController.routePacket(channel, route, packet);
    },

    executeRaw: function(channel, route, executorArray, packet, callBack) {

        if (typeof callBack === 'function') {
            this.createCallBack(callBack, executorArray, packet);
        }

        routeController.routePacket(channel, route, packet);
    },

    // a method to process a packet for multiple executors
    // args is initially an arguments object
    processPacket: function(executorArray, packet, args) {

        if (typeof args[args.length - 1] === 'function') {
            args = Array.slice(args);
            this.createCallBack(args.pop(), executorArray, packet);
        }

        packet.args = args;

        return packet;
    },

    // Incoming CallBack Generator
    // Creates an expected Callback method, whose index is sent to clients.
    // The callback will expect a certain number of processes/clients to execute before getting deleted/set to undefined.
    createCallBack: function(theCallBack, executorArray, packet) {
        var incomingCallback = new IncomingCallBack(theCallBack, executorArray);
        var callbackID = incomingCallback.id;

        incomingCallbacks[callbackID] = incomingCallback;
        packet.callBack = callbackID;

        return incomingCallback;
    },

    destroyCallBack: function(callbackID) {
        incomingCallbacks[callbackID] = undefined;
    },

    // Exposed CallBack Execution Method
    // Allows the client to execute an indexed method that was stored for callback
    callItBack: function(callbackID, args) {

        var executor = this,
            executorID = executor.id,
            theCallBack = incomingCallbacks[callbackID];

        if (theCallBack !== undefined && args instanceof Array) {

            if (typeof arguments[arguments.length - 1] === 'function') {
                args.push(arguments[arguments.length - 1]);
            }

            theCallBack.executeCallBack(executorID, executor, args);
        }
    },

    // Exposed CallBack Execution Error Method
    // Allows the client to execute an indexed method that was stored for callback
    callItBackError: function(callbackID, args) {

        var executor = this,
            executorID = executor.id,
            theCallBack = incomingCallbacks[callbackID];

        if (theCallBack !== undefined) {
            theCallBack.callBackError(executorID, executor, args);
        }
    },


    // Incoming Execution

    executeFunction: function(executor, context, incomingPacket, callBackGenerator) {

        var functionName = incomingPacket.func,
            namespaceName = incomingPacket.ns || 'core',
            namespace = this.nameSpace(namespaceName),
            namespaceMethods,
            messageArgs,
            theCallBack,
            callbackID;

        if (namespace !== undefined) {

            namespaceMethods = namespace.methods;

            if (typeof namespaceMethods[functionName] === 'function') {

                messageArgs = incomingPacket.args || [];

                callBackGenerator = callBackGenerator || this.createOutgoingCallBack;
                callbackID = incomingPacket.callBack;

                if (typeof callbackID === 'string' && callbackID.match(/^([a-zA-Z0-9\.]+)$/)) {
                    theCallBack = outgoingCallBacks[callbackID] = callBackGenerator(callbackID, executor);
                    messageArgs.push(theCallBack);
                }

                namespaceMethods[functionName].apply(context, messageArgs);

            } else {
                console.error('Samsaara Method Execution ERROR: Call by:', incomingPacket.sender, ':', functionName, 'is not an exposed Samsaara Object that can be executed.');
            }

        } else {
            console.error('Samsaara Method Execution ERROR: Call by:', incomingPacket.sender, ':', namespaceName, 'is not valid namespace.');
        }
    },

    // Outgoing CallBack Generator
    // Returns a function to send a message answering a callBack request sent from the client
    createOutgoingCallBack: function(callbackID, executor) {
        var self = this;

        var theCallBack = function() {

            var args = Array.slice(arguments),
                packet = {
                    ns: 'internal',
                    func: 'callItBack',
                    args: [callbackID, args]
                },
                aCallBack;

            if (typeof args[args.length - 1] !== 'function') {
                executor.executeRaw(packet);
            } else {
                aCallBack = args.pop();
                executor.executeRaw(packet, aCallBack);
            }

            delete self.outgoingCallBacks[callbackID];
        };

        return theCallBack;
    },


    // Exported to Core

    createNamespace: function(namespaceName, methods) {
        var nameSpace = null;

        if (namespaceName !== 'core' && namespaceName !== 'internal') {
            nameSpace = new NameSpace(namespaceName, methods);
            nameSpaces[namespaceName] = nameSpace;
        }

        return core;
    },

    nameSpace: function(namespaceName) {
        return nameSpaces[namespaceName];
    },

    expose: function(set) {
        this.nameSpace('core').expose(set);
        return core;
    }
};


module.exports = executionController;
