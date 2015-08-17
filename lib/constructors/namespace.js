function NameSpace(namespaceName, methods) {
    this.id = namespaceName;
    this.methods = methods || {};
}

NameSpace.prototype.expose = function(methods) {
    var method;
    for (method in methods) {
        this.methods[method] = methods[method];
    }
    return this;
};


module.exports = NameSpace;
