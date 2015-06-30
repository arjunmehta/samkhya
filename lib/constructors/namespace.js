/*!
 * samsaaraSocks - CallBack Constructor
 * Copyright(c) 2014 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var debug = require('debug')('samsaara:namespaces');


function initialize(uuid){
  return NameSpace;
}

function NameSpace(namespace_name, methods){
  this.id = namespace_name;
  this.methods = methods || {};
}

NameSpace.prototype.expose = function(methods){
  for(var method in methods){
    this.methods[method] = methods[method];
  }    
};

exports = module.exports = {
  initialize: initialize,
  Constructor: NameSpace
};

