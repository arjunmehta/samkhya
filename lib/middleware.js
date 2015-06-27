var debug = require('debug')('samsaara:middleware');
var Connection;


function MiddlewareLoader(samsaara) {

    this.core = samsaara;

    this.communication_controller = samsaara.communicationController;
    this.connection_controller = samsaara.connectionController;
    this.router = samsaara.router;
    this.constructors = samsaara.constructors;

    this.pre_initialized_modules = samsaara.modules;
    this.initialized_modules = [];

    Connection = samsaara.constructors.Connection;
}

MiddlewareLoader.prototype.load = function(samsaara) {

    for (var i = 0; i < this.pre_initialized_modules.length; i++) {
        this.initializeModule(this.pre_initialized_modules[i]);
    }

    for (var j = 0; j < this.initialized_modules.length; j++) {
        this.finalizeModule(this.initialized_modules[j]);
    }
};

MiddlewareLoader.prototype.new = function(new_middleware) {
    this.pre_initialized_modules.push(new_middleware);
};

MiddlewareLoader.prototype.initializeModule = function(middleware) {

    var initialized_module = middleware.initialize(this.core);
    var module_name = initialized_module.name;

    this.initialized_modules.push(module_name, initialized_module);

    // Gives samsaara a namespace for the middleware. (ie. samsaara.groups, samsaara.authentication etc.)

    if (module_name) {

        this.core.capability[module_name] = true;

        if (!this.core[module_name]) {
            this.core[module_name] = {};
        }

    } else {

        throw new Error("samsaara middleware requires a unique name.");
    }

    this.addCoreMethods(module_name, initialized_module);
    this.addModuleMethods(module_name, initialized_module);    
    this.addRemoteMethods(module_name, initialized_module);

    this.addConnectionPreInitialization(module_name, initialized_module);
    this.addConnectionInitialization(module_name, initialized_module);
    this.addConnectionClose(module_name, initialized_module);

    this.addPreRouteFilter(module_name, initialized_module);
    this.addMessageRoutes(module_name, initialized_module);    

    debug("Samsaara middleware module", module_name, "...Loaded");
};


// Add methods to expose on samsaara for local access. These must be uniquely named.
// ie. samsaara.group('group_name')

MiddlewareLoader.prototype.addCoreMethods = function(module_name, initialized_module) {

    var methods = initialized_module.coreMethods;

    for (var method in methods) {

        if (!this.core[method]) {
            this.core[method] = methods[method];
        } else {
            throw new Error("Foundation method or object: " + method + " is already an internal object or method name on samsaara");
        }
    }
};


// Adds new methods in the middleware to the module's own namespace.
// ie. samsaara.groups.group();

MiddlewareLoader.prototype.addModuleMethods = function(module_name, initialized_module) {

    var methods = initialized_module.moduleMethods;

    for (var method_name in methods) {
        if (module_name) {
            this.core[module_name][method_name] = methods[method_name];
        }
    }
};


// Adds remotely accessible methods to samsaara's internal namespace. (Should be configurable)
// ie. samsaara.execute('sendToGroup')

MiddlewareLoader.prototype.addRemoteMethods = function(module_name, initialized_module) {

    var methods = initialized_module.remoteMethods;
    this.core.nameSpace("internal").expose(methods);
};


// Adds methods to execute when a new connection is made but not initialized yet.

MiddlewareLoader.prototype.addConnectionPreInitialization = function(module_name, initialized_module) {

    if (typeof initialized_module.addConnectionPreInitialization === 'function') {
        Connection.preInitializationMethods.push(initialized_module.addConnectionPreInitialization);
    }
};


// Adds methods to execute to initialize a connection.

MiddlewareLoader.prototype.addConnectionInitialization = function(module_name, initialized_module) {

    if (typeof initialized_module.addConnectionInitialization === 'function') {
        Connection.initializationMethods[module_name] = initialized_module.addConnectionInitialization;
    }
};


// Adds methods to execute when a connection is closed.

MiddlewareLoader.prototype.addConnectionClose = function(module_name, initialized_module) {

    if (typeof initialized_module.connectionClose === 'function') {
        Connection.closingMethods.push(initialized_module.connectionClose);
    }
};


// Adds methods to execute when a new message comes in before it is routed to a method or process (ipc).

MiddlewareLoader.prototype.addPreRouteFilter = function(module_name, initialized_module) {

    if (typeof initialized_module.preRouteFilter === 'function') {
        this.core.router.preRouteFilters.push(initialized_module.preRouteFilter);
    }
};


// Adds methods to execute when a new message comes in before it is routed to a method or process (ipc).

MiddlewareLoader.prototype.addMessageRoutes = function(module_name, initialized_module) {

    var routes = initialized_module.messageRoutes;

    for (var route in routes) {
        this.core.router.messageRoutes[route] = routes[route];
    }
};


// Wraps up any kind of settings after all modules have been added

MiddlewareLoader.prototype.finalizeModule = function(initialized_module) {

    if (typeof initialized_module.finalize === "function") {
        initialized_module.finalize();
    }
};


exports = module.exports = {
    initialize: initialize
};
