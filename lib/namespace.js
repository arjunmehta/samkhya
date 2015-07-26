/*!
 * samsaaraSocks - CallBack Constructor
 * Copyright(c) 2014 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

function initialize(pseudoUuid) {
    return NameSpace;
}


function NameSpace(namespaceName, methods) {
    this.id = namespaceName;
    this.methods = methods || {};
}

NameSpace.prototype.expose = function(methods) {
    var method;
    for (method in methods) {
        this.methods[method] = methods[method];
    }
};


module.exports = {
    initialize: initialize,
    Constructor: NameSpace
};
