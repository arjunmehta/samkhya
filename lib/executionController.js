var IncomingCallBack = require('./constructors/callback').Constructor,
    NameSpace = require('./constructors/namespace').Constructor;

var core,
    connection,
    routeController;

var incomingCallbacks = {},
    outgoingCallBacks = {},
    nameSpaces = {};

var executionController = {

    initialize: function(pseudoUuid, samsaaraCore, connectionCtrl, routeCtrl) {
        core = samsaaraCore;
        connection = connectionCtrl.connection;
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
            this.makeCallBack(packet.args.pop(), executorArray, packet);
        }

        routeController.routePacket(channel, route, packet);
    },

    executeRaw: function(channel, route, executorArray, packet, callBack) {

        if (typeof callBack === 'function') {
            this.makeCallBack(callBack, executorArray, packet);
        }

        routeController.routePacket(channel, route, packet);
    },

    // a method to process a packet for multiple executors
    // args is initially an arguments object
    processPacket: function(executorArray, packet, args) {

        if (typeof args[args.length - 1] === 'function') {
            args = Array.slice(args);
            this.makeCallBack(args.pop(), executorArray, packet);
        }

        packet.args = args;

        return packet;
    },

    // Incoming CallBack Generator
    // Creates an expected Callback method, whose index is sent to clients.
    // The callback will expect a certain number of processes/clients to execute before getting deleted/set to undefined.
    makeCallBack: function(theCallBack, executorArray, packet) {

        var incomingCallback = new IncomingCallBack(theCallBack, executorArray);
        var callbackID = incomingCallback.id;

        incomingCallbacks[callbackID] = incomingCallback;
        packet.callBack = callbackID;

        return incomingCallback;
    },

    // Exposed CallBack Execution Method
    // Allows the client to execute an indexed method that was stored for callback
    callItBack: function(executorID, callbackID, args) {

        var executor = connection(executorID);
        var theCallBack = incomingCallbacks[callbackID];

        if (theCallBack !== undefined && args instanceof Array) {

            if (typeof arguments[arguments.length - 1] === 'function') {
                args.push(arguments[arguments.length - 1]);
            }

            theCallBack.executeCallBack(executorID, executor, args);
        }
    },

    // Exposed CallBack Execution Error Method
    // Allows the client to execute an indexed method that was stored for callback
    callItBackError: function(executorID, callbackID, args) {

        var executor = connection(executorID);
        var theCallBack = incomingCallbacks[callbackID];

        if (theCallBack !== undefined) {
            theCallBack.callBackError(executorID, executor, args);
        }
    },


    // Incoming Execution

    createNamespace: function(namespaceName, methods) {
        var nameSpace = null;

        if (namespaceName !== 'core' && namespaceName !== 'internal') {
            nameSpace = nameSpaces[namespaceName] = new NameSpace(namespaceName, methods);
        }

        return nameSpace;
    },

    nameSpace: function(namespaceName) {
        return nameSpaces[namespaceName];
    },

    expose: function(set) {
        this.nameSpace('core').expose(set);
        return core;
    },

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
                    theCallBack = outgoingCallBacks[callbackID] = callBackGenerator(callbackID, incomingPacket.sender, incomingPacket.owner);
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

    createOutgoingCallBack: function(callbackID, senderID, ownerID) {
        var self = this;

        var theCallBack = function() {

            var args = Array.slice(arguments),
                packet = {
                    ns: 'internal',
                    func: 'callItBack',
                    args: [ownerID, callbackID, args]
                },
                aCallBack;

            if (typeof args[args.length - 1] !== 'function') {
                connection(senderID).executeRaw(packet);
            } else {
                aCallBack = args.pop();
                connection(senderID).executeRaw(packet, aCallBack);
            }

            delete self.outgoingCallBacks[callbackID];
        };

        return theCallBack;
    }
};


module.exports = executionController;
