var logError = require('debug')('samsaara:communication:error');

var IncomingCallBack = require('./constructors/callback').Constructor,
    NameSpace = require('./constructors/namespace').Constructor;

var samsaara_id,
    core,
    connection;


function CommunicationController(uuid, samsaara_core, connection_controller) {

    samsaara_id = uuid;
    core = samsaara_core;
    connection = connection_controler.connection;

    this.outgoingCallBacks = {};
    this.incoming_callbacks = {};
    this.nameSpaces = {};

    this.createNamespace('core', {});
    this.createNamespace('internal', {
        callItBack: this.callItBack,
        callItBackError: this.callItBackError
    });
}


// OUTGOING

CommunicationController.prototype.executeRaw = function(executor, packet, callBack) {

    if (typeof callback === 'function') {
        this.makeCallBack(callback, [executor.id], packet);
    }

    executor.send(stringifyPacket(packet));
};


// args is initially an arguments object

CommunicationController.prototype.execute = function(executor, packet, args) {

    var callback;

    if (typeof args[args.length - 1] === 'function') {
        args = Array.slice(args);
        callback = args.pop();
    }

    packet.args = args;

    this.executeRaw(executor, packet, callback);
};


// a method to process a packet for multiple executors
// args is initially an arguments object

CommunicationController.prototype.processPacket = function(executor_array, packet, args) {

    if (typeof args[args.length - 1] === 'function') {
        args = Array.slice(args);
        this.makeCallBack(args.pop(), executor_array, packet);
    }

    packet.args = args;

    return stringifyPacket(packet);
};


// Incoming CallBack Generator
// Creates an expected Callback method, whose index is sent to clients.
// The callback will expect a certain number of processes/clients to execute before getting deleted/set to undefined.

CommunicationController.prototype.makeCallBack = function(theCallBack, executor_array, packet) {

    var incoming_callback = new IncomingCallBack(theCallBack, executor_array);
    var callback_id = incoming_callback.id;

    this.incoming_callbacks[callback_id] = incoming_callback;
    packet.callBack = callback_id;

    return incoming_callback;
};

// Exposed CallBack Execution Method
// Allows the client to execute an indexed method that was stored for callback

CommunicationController.prototype.callItBack = function(executor_id, callback_id, args) {

    var executor = connection(executor_id);
    var theCallBack = this.incoming_callbacks[callback_id];

    if (theCallBack !== undefined && args instanceof Array) {

        if (typeof arguments[arguments.length - 1] === 'function') {
            args.push(arguments[arguments.length - 1]);
        }

        theCallBack.executeCallBack(executor_id, executor, args);
    }
};


// Exposed CallBack Execution Error Method
// Allows the client to execute an indexed method that was stored for callback

CommunicationController.prototype.callItBackError = function(executor_id, callback_id, args) {

    var executor = connection(executor_id);
    var theCallBack = this.incoming_callbacks[callback_id];

    if (theCallBack !== undefined) {
        theCallBack.callBackError(executor_id, executor, args);
    }
};


CommunicationController.prototype.createNamespace = function(namespace_name, methods) {

    this.nameSpaces[namespace_name] = new NameSpace(namespace_name, methods);
    return nameSpaces[namespace_name];
};

CommunicationController.prototype.nameSpace = function(namespace_name) {
    return this.nameSpaces[namespace_name];
};


// INCOMING

CommunicationController.prototype.expose = function(set) {
    this.nameSpace('core').expose(set);
    return core;
};


CommunicationController.prototype.executeFunction = function(executor, context, incoming_packet, callBackGenerator) {

    var function_name = incoming_packet.func,
        namespace_name = incoming_packet.ns || 'core',
        namespace = this.nameSpace(namespace_name),
        namespace_methods,
        message_args,
        callback_id;

    if (namespace !== undefined) {

        namespace_methods = namespace.methods;

        if (typeof namespace_methods[function_name] === 'function') {

            message_args = incoming_packet.args || [];

            callBackGenerator = callBackGenerator || this.createOutgoingCallBack;
            callback_id = incoming_packet.callBack;

            if (typeof callback_id === 'string' && callback_id.match(/^([a-zA-Z0-9\.]+)$/)) {
                var theCallBack = this.outgoingCallBacks[callback_id] = callBackGenerator(callback_id, incoming_packet.sender, incoming_packet.owner);
                message_args.push(theCallBack);
            }

            namespace_methods[function_name].apply(context, message_args);

        } else {
            console.error('Samsaara Method Execution ERROR: Call by:', incoming_packet.sender, ':', function_name, 'is not an exposed Samsaara Object that can be executed.');
        }

    } else {
        console.error('Samsaara Method Execution ERROR: Call by:', incoming_packet.sender, ':', namespace_name, 'is not valid namespace.');
    }
};


// Outgoing CallBack Generator
// Returns a function to send a message answering a callBack request sent from the client

CommunicationController.prototype.createOutgoingCallBack = function(callback_id, sender_id, owner_id) {

    var self = this;

    var theCallBack = function() {

        var args = Array.slice(arguments),
            packet = {
                ns: 'internal',
                func: 'callItBack',
                args: [callback_id, owner_id, args]
            },
            aCallBack;

        if (typeof args[args.length - 1] !== 'function') {
            self.executeRaw(connection(sender_id), packet);
        } else {
            aCallBack = args.pop();
            self.executeRaw(connection(sender_id), packet, aCallBack);
        }

        delete self.outgoingCallBacks[id];
    };

    return theCallBack;
};


function stringifyPacket(packet) {

    var packet_string;

    try {
        packet_string = JSON.stringify([samsaara_id, packet]);
    } catch (err) {
        console.error('Error Sending Packet:', samsaara_id, packet, err);
    }

    return packet_string;
}


exports = module.exports = function(uuid, connection_constructor){
  return new CommunicationController(uuid, connection_constructor);
};
