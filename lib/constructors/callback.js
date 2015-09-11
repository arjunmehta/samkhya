var helper = require('../utils/helper');

var convertToObj = helper.convertToObj;
var makeUniqueCallBackID = helper.makeUniqueCallBackID;


function IncomingCallBack(theCallBack, executorArray, destroy) {
    this.callbackID = makeUniqueCallBackID();
    this.callBack = theCallBack;
    this.executorList = convertToObj(executorArray);
    this.executorCount = executorArray.length;
    this.destroy = destroy;
}

IncomingCallBack.prototype.addConnections = function(executorArray) {
    var i;

    for (i = 0; i < executorArray.length; i++) {
        this.executorList[executorArray[i]] = true;
    }

    this.executorCount += executorArray.length;
};

IncomingCallBack.prototype.addConnection = function(executorID) {
    this.executorList[executorID] = true;
    this.executorCount++;
};

IncomingCallBack.prototype.executeCallBack = function(executorID, executor, args) {

    if (this.executorList[executorID] !== undefined) {

        this.callBack.apply(executor, args);
        this.executorList[executorID] = undefined;
        this.executorCount--;
        this.evaluateDestroy();
    }
};

IncomingCallBack.prototype.callBackError = function(executorID) {

    if (this.executorList[executorID] !== undefined) {

        this.executorList[executorID] = undefined;
        this.executorCount--;
        this.evaluateDestroy();
    }
};

IncomingCallBack.prototype.evaluateDestroy = function() {

    if (this.executorCount <= 0) {
        this.destroy(this.callbackID);
    }
};


module.exports = IncomingCallBack;
