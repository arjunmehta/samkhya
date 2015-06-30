/*!
 * samsaaraSocks - CallBack Constructor
 * Copyright(c) 2014 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var core;
var uuid;
var incoming_callbacks;
var init_offset = 1000;
var callback_id_offset = 0;


function initialize(samsaaraCore) {

    core = samsaaraCore;
    uuid = core.uuid;
    incoming_callbacks = samsaaraCore.communication.incoming_callbacks;

    return IncomingCallBack;
}


function IncomingCallBack(theCallBack, executor_array) {
    this.callback_id = makeUniqueCallBackID();
    this.callBack = theCallBack;
    this.executor_list = convertToObj(executor_array);
    this.executor_count = executor_array.length;
}


IncomingCallBack.prototype.addConnections = function(executor_array) {

    for (var i = 0; i < executor_array.length; i++) {
        this.executor_list[executor_array[i]] = true;
    }

    this.executor_count += executor_array.length;
};

IncomingCallBack.prototype.addConnection = function(executor_id) {

    this.executor_list[executor_id] = true;
    this.executor_count++;
};

IncomingCallBack.prototype.executeCallBack = function(executor_id, executor, args) {

    if (this.executor_list[executor_id] !== undefined) {
        
        this.callBack.apply(executor, args);
        this.executor_list[executor_id] = undefined;
        this.executor_count--;        
        this.evaluateDestroy();
    }
};

IncomingCallBack.prototype.callBackError = function(executor_id) {

    if (this.executor_list[executor_id] !== undefined) {
        
        this.executor_list[executor_id] = undefined;
        this.executor_count--;        
        this.evaluateDestroy();
    }
};

IncomingCallBack.prototype.evaluateDestroy = function() {

    if (this.executor_count <= 0) {
        this.destroy();
    }
};

IncomingCallBack.prototype.destroy = function() {
    incoming_callbacks[this.callback_id] = undefined;
};


// helper methods

function makeUniqueCallBackID() {
    callback_id_offset = callback_id_offset++ > 1000000 ? 0 : callback_id_offset;
    return makePseudoRandomID() + uuid + callback_id_offset;
}

function makePseudoRandomID() {
    return (Math.random() * 10000).toString(36);
}

function convertToObj(array) {

    var obj = {};

    for (var i = 0; i < array.length; i++) {
        obj[array[i]] = true;
    }

    return obj;
}


exports = module.exports = {
    initialize: initialize,
    Constructor: IncomingCallBack
};
