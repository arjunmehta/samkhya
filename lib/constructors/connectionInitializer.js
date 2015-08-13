function ConnectionInitializer(connection) {
    this.connection = connection;
    this.forced = {};
}

Object.defineProperty(ConnectionInitializer.prototype, 'initialized', {
    get: function() {
        var forced = this.forced,
            moduleName;

        for (moduleName in forced) {
            if (forced[moduleName] === false) {
                return false;
            }
        }
        return true;
    }
});

ConnectionInitializer.prototype.initialize = function(initializationMethods, opts, done) {
    var moduleName;
    this.done = done;

    if (Object.keys(initializationMethods).length > 0) {
        for (moduleName in initializationMethods) {
            if (initializationMethods[moduleName].forced === true) {
                this.forced[moduleName] = false;
            }
        }

        for (moduleName in initializationMethods) {
            initializationMethods[moduleName].init(this.connection, opts, buildInitializedClosure(this, moduleName));
        }
    } else {
        done();
    }
};

ConnectionInitializer.prototype.initializedModule = function(moduleName) {
    if (this.forced[moduleName] !== undefined) {
        this.forced[moduleName] = true;
        if (this.initialized === true) {
            this.done();
        }
    }
};


// Closure returns a callback method to be called by middleware when initialized.

function buildInitializedClosure(initializer, moduleName) {
    return function() {
        initializer.initializedModule(moduleName);
    };
}
