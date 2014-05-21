/*!
 * samsaaraSocks - CallBack Constructor
 * Copyright(c) 2014 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */

var debug = require('debug')('samsaara:namespaces');


var core;
var nameSpaces;


function initialize(samsaaraCore, nameSpacesObj){

  debug("Initializing Namespaces", samsaaraCore.communication.nameSpaces);

  core = samsaaraCore;
  nameSpaces = samsaaraCore.communication.nameSpaces;

  return NameSpace;
}


function NameSpace(nameSpaceName, methods){
  this.name = this.id = nameSpaceName;
  this.methods = methods || {};
}

NameSpace.prototype.expose = function(methods){
  for(var method in methods){
    this.methods[method] = methods[method];
  }
};


exports = module.exports = {
  initialize: initialize,
  NameSpace: NameSpace
};

