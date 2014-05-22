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
    for(var func in set){
      exposedMethods[func] = set[func];
    }
  };


  // add an internal "special" method

  samsaara.addInternalMethod = function(name, func){
    if(!internalMethods[name]){
      internalMethods[name] = func;
    }
  };


  // load middleware modules

  samsaara.use = function(module){

    if(typeof module === "function"){
      module = module(samsaara, attributes);
    }

    samsaaraDebug("Trying to use", module);

    if(module.internalMethods){
      for(var methodName in module.internalMethods){

        samsaaraDebug("Trying to use", methodName);

        if(!internalMethods[methodName]){
          internalMethods[methodName] = module.internalMethods[methodName];
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
    send( packet, core.samsaaraOwner );
  };


  // creates a namespace object that holds an execute method with the namespace as a closure..

  samsaara.nameSpace = function(nameSpaceName){
    return {
      execute: function execute(){
        var packet = {ns: nameSpaceName, func: arguments[0], args: []};
        packet = processPacket(packet, arguments);
        send( packet, core.samsaaraOwner );
      }
    };
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

  function sendRawWithHeaders(message, owner, customHeaderList){
    var header = owner;

    for(var key in headerList){
      header += ":" + key + ":" + headerList[key];
    }

    if(customHeaderList){
      for(var customKey in customHeaderList){
        header += ":" + customKey + ":" + customHeaderList[customKey];
      }
    }

    header += "::";

    sendRaw(header + message);
  }


  // determine whether or not to send the package now, or later

  function send(packet, owner, headers){

    if(preinitialized === true){
      sendRawWithHeaders( JSON.stringify(packet), owner, headers);
    }
    else{
      functionQueue.push( [ packet, owner, headers ] );
    }
  }


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
        samsaaraDebug(err);
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
          send( functionQueue[i][0], functionQueue[i][1], functionQueue[i][2]);
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

    if(messageRoutes[messageParsed[0]] !== undefined){
      messageRoutes[messageParsed[0]](messageObj);
    }
    else{
      messageObj.owner = messageParsed[0];
    }

    if(messageObj.func !== undefined){
      if(exposedMethods[messageObj.func] !== undefined){
        executeFunction(exposedMethods[messageObj.func], messageObj);
      }
      else{
        samsaaraDebug("Samsaara Error:", messageObj.func, "Is not a valid property of this Samsaara Object", messageObj);
        if(messageObj.callBack){
          send({ns: "internal", func: "callItBackError", args: [messageObj.callBack, ["ERROR: Invalid Object on Client"]]}, messageObj.owner);
        }
      }
    }

    if(messageObj.internal !== undefined){
      if(internalMethods[messageObj.internal] !== undefined){
        executeFunction(internalMethods[messageObj.internal], messageObj);
      }
      else{
        samsaaraDebug("Samsaara Error:", messageObj.internal, "Is not a valid property of this Samsaara Object");
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

      var packet = {ns:"internal", func:"callItBack", args: []};
      var args = Array.prototype.slice.call(arguments);
      
      if(typeof args[args.length-1] === "function"){
        var aCallBack = args.pop();
        packet = processPacket(packet, [id, args, aCallBack]);
      }
      else{
        packet = processPacket(packet, [id, args]);
      }

      send(packet, owner);
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
      samsaaraID = messageObj.samsaaraID;
      samsaaraDebug("CONNECTED AS:" + samsaaraID);
    }
    if(messageObj.samsaaraOwner !== undefined){
      samsaaraOwner = messageObj.samsaaraOwner;
      sendRawWithHeaders( JSON.stringify({opts: remoteOptions}), samsaaraOwner);
      samsaaraDebug("samsaaraOwner:" + samsaaraOwner);
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




