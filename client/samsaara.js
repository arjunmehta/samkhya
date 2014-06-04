/*!
 * samsaara client
 *
 * Copyright(c) 2013-2014 Arjun Mehta <arjun@newlief.com>
 * MIT Licensed
 */


var samsaara = (function(samsaara){


  samsaaraDebug = debug('samsaara:main');
  samsaaraDebugCallBack = debug('samsaara:callback');


  // samsaara is an instance of an EventEmitter

  samsaara = new EventEmitter();


  // set up core variables

  var core = {
    samsaara: samsaara,
    samsaaraID : "",
    samsaaraOwner: "",
    options: {}
  };

  var samsaaraID,
      samsaaraOwner,
      preinitialized = false;

  var remoteOptions = {};
  var options;

  var sockjs_url = '/echo';
  var sockjs = {};
  var sockConnectionTimerTime = 0;
  var sockConnectionTimer = null;

  var heartBeat = {},
      lastBeat = 0, heartBeatBeat = 0;

  var functionQueue = [];

  var outgoingCallBacks = {};
  var incomingCallBacks = {};

  var initializationMethods = [];
  var internalMethods = {};
  var exposedMethods = {};
  var messageRoutes = {};
  var headerList = {};

  var nameSpaces = {};


  samsaara.self = "samsaara.self";


  // initialize samsaara with a set of options (passed to server)

  samsaara.initialize = function(opts){

    options = opts;

    if(opts){
      for(var opt in opts){
        remoteOptions[opt] = opts[opt];
      }
      if(opts.socksURL){
        sockjs_url = opts.socksURL;
      }
    }
    initSock();
  };


  // expose a method or a set of methods

  samsaara.expose = function(set){
    nameSpaces.core.expose(set);
  };



  // load middleware modules

  samsaara.use = function(module){

    if(typeof module === "function"){
      module = module(core, attributes);
    }

    samsaaraDebug("Trying to use", module);

    if(module.internalMethods){
      nameSpaces.internal.expose(module.internalMethods);
    }

    if(module.main){
      for(var methodName in module.main){
        if(!samsaara[methodName]){
          samsaara[methodName] = module.main[methodName];
        }
      }
    }

    if(module.messageRoutes){
      for(var routeName in module.messageRoutes){
        if(!messageRoutes[routeName]){
          messageRoutes[routeName] = module.messageRoutes[routeName];
        }
      }
    }

    if(module.initializationMethods){
      // samsaaraDebug("initializationMethods", module.initializationMethods);
      for(var initMethod in module.initializationMethods){
        initializationMethods.push(module.initializationMethods[initMethod]);
      }
    }
  };


  // exposed execution method, takes client input and sends it through the packet processing chain.

  samsaara.execute = function(){
    var packet = {func: arguments[0], args: []};
    packet = processPacket(packet, arguments);
    send( packet, (core.samsaaraOwner) ? "OWN:"+core.samsaaraOwner : undefined);
  };


  // creates a namespace object that holds an execute method with the SERVER namespace as a closure..

  samsaara.nameSpace = function(nameSpaceName){
    return {
      execute: function execute(){
        var packet = {ns: nameSpaceName, func: arguments[0], args: []};
        packet = processPacket(packet, arguments);
        send( packet, (core.samsaaraOwner) ? "OWN:"+core.samsaaraOwner : undefined );
      }
    };
  };




  // local namespaces

  var createLocalNamespace = samsaara.createLocalNamespace = function(nameSpaceName, exposed){
    if(!nameSpaces[nameSpaceName]){
      nameSpaces[nameSpaceName] = new NameSpace(nameSpaceName, exposed);
    }
    return nameSpaces[nameSpaceName];
  };

  function NameSpace(nameSpaceName, exposed){
    this.id = nameSpaceName;
    this.methods = exposed || {};
  }

  NameSpace.prototype.expose = function(methods){
    for(var method in methods){
      this.methods[method] = methods[method];
    } 
  };


  // attributes of middleware that are initialized to set "preinitialized" state to start sending messages.

  var attributes = {initializedAttributes : {init: false} };

  attributes.force = function(attributeName){
    attributes.initializedAttributes[attributeName] = false;
  };

  attributes.initializedAttribute = function(attributeName){

    samsaaraDebug("Initialized Attribute", attributeName);

    attributes.initializedAttributes[attributeName] = true;
    if(attributes.allInitialized() === true){
      preinitialize();
    }
  };

  attributes.allInitialized = function(){
    for(var attr in attributes.initializedAttributes){
      if(attributes.initializedAttributes[attr] === false) return false;
    }
    return true;
  };

  attributes.updateHeaderList = function(headerKey, headerValue){
    headerList[headerKey] = headerValue;
  };


  // prepares raw JSON packet to be sent (without headers)

  var processPacket = core.processPacket = function(packet, args){

    for (var i = 1; i < args.length-1; i++){
      packet.args.push(args[i]);
    }

    if(typeof args[args.length-1] === "function"){
      packet = core.makeCallBack(packet, args[args.length-1]);
    }
    else{
      packet.args.push(args[args.length-1]);
    }

    return packet;
  };


  // creates a local callback that waits for a callItBack message from the server (see internalMethods.callItBack)

  var makeCallBack = core.makeCallBack = function(packet, theCallBack){

    if(typeof theCallBack === "function"){
      var callBackID = makeIdAlpha(12);
      incomingCallBacks[callBackID] = {callBack: theCallBack};
      packet.callBack = callBackID;
    }

    return packet;
  };


  // raw message send, updates heartbeat time.

  function sendRaw(message){
    samsaaraDebug("SENDING", message);
    lastBeat = heartBeatBeat;
    sockjs.send(message);
  }


  // adds headers to the raw message, including message owner, and other module headers

  function sendRawWithHeaders(message, route, headerExtra){
    var header = route;

    for(var key in headerList){
      header += ":" + key + ":" + headerList[key];
    }

    if(headerExtra){
      header += ":" + headerExtra;
    }

    header += "::";

    sendRaw(header + message);
  }


  // determine whether or not to send the package now, or later

  var send = core.send = function(packet, route, routeExtra){

    if(preinitialized === true){
      sendRawWithHeaders( JSON.stringify(packet), route, routeExtra);
    }
    else{
      functionQueue.push( [ packet, route, routeExtra ] );
    }
  };


  // initialize socket/sockjs

  function initSock(){

    sockjs = new SockJS(sockjs_url);

    sockjs.onopen = function(){

      samsaaraDebug('[*] samsaara socket open', sockjs.protocol);

      sockConnectionTimerTime = 0;

      for(var i=0; i<initializationMethods.length; i++){
        initializationMethods[i]();
      }
    };

    sockjs.onmessage = function(e){

      var messageParsed = {};

      try{
        samsaaraDebug("INCOMING MESSAGE", e.data);
        messageParsed = JSON.parse(e.data);
      }
      catch(err){
        samsaaraDebug(new Error(err));
      }

      evalMessage(messageParsed);

    };

    sockjs.onclose = function(e){

      samsaaraDebug('[*] samsaara socket close');

      preinitialized = false;

      sockConnectionTimer = setTimeout(function(){

        // slow down reconnection attempts after a few

        var timeoutTime = sockConnectionTimerTime >= (15000/2) ? 15000 : (sockConnectionTimerTime*2 + 400);
        sockConnectionTimerTime = timeoutTime;
        initSock();

      }, sockConnectionTimerTime);
    };
  }


  // pre-initializes the module, and allows it to send messages (useful for authentication)

  function preinitialize(){

    if(preinitialized === false){

      preinitialized = true;

      if(functionQueue.length > 0){
        for(var i=0; i < functionQueue.length; i++){
          send( functionQueue[i][0], functionQueue[i][1] || "OWN:"+core.samsaaraOwner, functionQueue[i][2]);
        }
        functionQueue = [];
      }
    }
  }


  // heartbeat to server. executed on an interval to keep the connection alive

  function heartBeater(){
    if(lastBeat < heartBeatBeat - 1){
      sendRaw('H');
    }
    heartBeatBeat++;
  }


  // pre-initializes the module, and allows it to send messages (useful for authentication)

  function evalMessage(messageParsed){

    var messageObj = messageParsed[1];
    var nsName = messageObj.ns || "core";
    var ns = nameSpaces[nsName];
    var func = messageObj.func;

    if(messageRoutes[messageParsed[0]] !== undefined){
      messageRoutes[messageParsed[0]](messageObj);
    }
    else{
      messageObj.owner = messageParsed[0];    

      if(func !== undefined && ns.methods[func] !== undefined){      
        executeFunction(ns.methods[func], messageObj);
      }
      else{
        samsaaraDebug(new Error("Samsaara Error: "+ func + " Is not a valid property of this Samsaara Object:" + JSON.stringify(messageObj) ));
        if(messageObj.callBack){
          send({ns: "internal", func: "callItBackError", args: [samsaara.self, messageObj.callBack, ["ERROR: Invalid Object on Client"]]}, "OWN:"+messageObj.owner);
        }
      }
    }
  }


  // executes a function from our message and builds a callback for it if it needs to

  function executeFunction(func, messageObj){

    if(messageObj.callBack !== undefined){

      var callBackID = messageObj.callBack;
      var theCallBack = outgoingCallBacks[callBackID] = createCallBack(callBackID, messageObj.owner);
      samsaaraDebugCallBack("Creating callback", callBackID, messageObj.owner);

      if(messageObj.args === undefined){
        messageObj.args = [];
      }
      messageObj.args.push(outgoingCallBacks[callBackID]);
    }

    func.apply(samsaara, messageObj.args);
  }


  // creates a closure that is placed in our outgoingCallBacks object list

  function createCallBack(id, owner){

    var theCallBack = function(){

      samsaaraDebugCallBack("executing callback", id, owner);

      var packet = {ns:"internal", func:"callItBack", args: [samsaara.self, id]};
      var args = Array.prototype.slice.call(arguments);
      
      if(typeof args[args.length-1] === "function"){
        var aCallBack = args.pop();
        packet = processPacket(packet, [null, args, aCallBack]);
      }
      else{
        packet = processPacket(packet, [null, args]);
      }

      send(packet, "OWN:"+owner);
      delete outgoingCallBacks[id];
    };

    return theCallBack;
  }


  // initialization route for messages sent with the init:: header

  messageRoutes.init = function(messageObj){
    if(messageObj.samsaaraHeartBeat){
      clearInterval(heartBeat);
      heartBeat = setInterval(heartBeater, messageObj.samsaaraHeartBeat);
    }
    if(messageObj.samsaaraID !== undefined){
      core.samsaaraID = messageObj.samsaaraID;
      samsaaraDebug("CONNECTED AS:" + core.samsaaraID);
    }
    if(messageObj.samsaaraOwner !== undefined){
      core.samsaaraOwner = messageObj.samsaaraOwner;
      sendRawWithHeaders( JSON.stringify({opts: remoteOptions}), "INIT");
      samsaaraDebug("samsaaraOwner:" + core.samsaaraOwner);
    }

    attributes.initializedAttribute("init");
  };


  // internal exposed methods that the server may call

  internalMethods.callItBack = function(id, owner, args){
    incomingCallBacks[id].callBack.apply(incomingCallBacks[id].from, args);
    delete incomingCallBacks[id];
  };

  internalMethods.reportError = function(code, message){
    samsaaraDebug("SAMSAARA SERVER ERROR:", code, message);
  };

  internalMethods.samsaaraInitialized = function(initialized, callBack){
    samsaara.emitEvent("initialized");
    if(typeof callBack === "function") callBack(true);
  };


  createLocalNamespace("internal", internalMethods);
  createLocalNamespace("core", {});

  // helper method to generate a psudounique hash of any length

  function makeIdAlpha(idLength){
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    for( var i=0; i < idLength; i++ ){
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }


  // return our final, complete, samsaara!

  return samsaara;

}(this.samsaara = this.samsaara || {}));




// samsaara.sanghaKara(contextID, "functionName", arg1, arh2, arg3);
// samsaara.vargaKara(contextID, "functionName", arg1, arh2, arg3);
// samsaara.kara(contextID, "functionName", arg1, arh2, arg3);




