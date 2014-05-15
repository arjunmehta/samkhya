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

  var samsaaraID,
      samsaaraToken,
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


  // server-side function execution

  var func = samsaara.func = function(fname){
    var args = arguments;
    var packet = { func: fname };    
    processAndSend(1, packet, args, samsaaraOwner);
  };

  var nsFunc = samsaara.nsFunc = function(ns, fname){
    var args = arguments;
    var packet = { ns: ns, func: fname };
    processAndSend(2, packet, args, samsaaraOwner);
  };


  // raw message send, updates heartbeat time.

  function sendRaw(message){    
    samsaaraDebug("SENDING",message);
    lastBeat = heartBeatBeat;
    sockjs.send(message);
  }


  // adds headers to the raw message, including owner, and other module headers

  function sendRawWithHeaders(owner, customHeaderList, message){
    var header = owner;

    for(var key in headerList){
      header += ":" + key + ":" + headerList[key];
    }
    for(var customKey in customHeaderList){
      header += ":" + customKey + ":" + customHeaderList[customKey];
    }
    header += "::";

    sendRaw(header + message);
  }


  // package a more high level JSON object to include a callback and owner

  function send(packetJSON, owner, callBack){

    if(typeof callBack === "function"){
      var callBackID = makeIdAlpha(12);
      incomingCallBacks[callBackID] = {callBack: callBack};
      packetJSON.callBack = callBackID;
    }

    if(preinitialized === true){
      sendRawWithHeaders( owner, {}, JSON.stringify(packetJSON) );
    }
    else{
      functionQueue.push( packetJSON );
    }
  }

  function nsSend(ns, packet, callBack){
    packet.ns = ns;
    send(packet, callBack);
  }


  // process message arguments and send

  function processAndSend(offset, packet, args, owner){
    if(args.length > offset){
      packet.args = [];
      for(var i = offset; i < args.length-1; i++){
        packet.args.push(args[i]);
      }
      if(typeof args[args.length-1] === "function"){
        send(packet, owner, args[args.length-1]);
      }
      else{
        packet.args.push(args[args.length-1]);
        send(packet, owner);
      }
    }
    else{
      send(packet, owner);
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
          send( functionQueue[i], samsaaraOwner);
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
        execute(exposedMethods[messageObj.func], messageObj);
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
        execute(internalMethods[messageObj.internal], messageObj);
      }
      else{
        samsaaraDebug("Samsaara Error:", messageObj.internal, "Is not a valid property of this Samsaara Object");
      }
    }
  }


  // executes a function from our message and builds a callback for it if it needs to

  function execute(func, messageObj){

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

      var args = Array.prototype.slice.call(arguments);
      if(typeof args[args.length-1] === "function"){
        var aCallBack = args.pop();
        processAndSend(0, {ns:"internal", func:"callItBack"}, [id, args, aCallBack], owner);
      }
      else{
        processAndSend(0, {ns:"internal", func:"callItBack"}, [id, args], owner);
      }
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
      sendRawWithHeaders( samsaaraOwner, {}, JSON.stringify({opts: remoteOptions}) );
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








 //Browser Detect Script: http://www.quirksmode.org/js/detect.html

// var BrowserDetect = {
//   init: function () {
//     this.browser = this.searchString(this.dataBrowser) || "An unknown browser";
//     this.version = this.searchVersion(navigator.userAgent) || this.searchVersion(navigator.appVersion) || "an unknown version";
//     this.OS = this.searchString(this.dataOS) || "an unknown OS";
//   },
//   searchString: function (data) {
//     for (var i=0;i<data.length;i++)  {
//       var dataString = data[i].string;
//       var dataProp = data[i].prop;
//       this.versionSearchString = data[i].versionSearch || data[i].identity;
//       if (dataString) {
//         if (dataString.indexOf(data[i].subString) != -1)
//           return data[i].identity;
//       }
//       else if (dataProp)
//         return data[i].identity;
//     }
//   },
//   searchVersion: function (dataString) {
//     var index = dataString.indexOf(this.versionSearchString);
//     if (index == -1) return;
//     return parseFloat(dataString.substring(index+this.versionSearchString.length+1));
//   },
//   dataBrowser: [
//     {
//       string: navigator.userAgent,
//       subString: "Chrome",
//       identity: "Chrome"
//     },
//     {
//        string: navigator.userAgent,
//       subString: "OmniWeb",
//       versionSearch: "OmniWeb/",
//       identity: "OmniWeb"
//     },
//     {
//       string: navigator.vendor,
//       subString: "Apple",
//       identity: "Safari",
//       versionSearch: "Version"
//     },
//     {
//       prop: window.opera,
//       identity: "Opera",
//       versionSearch: "Version"
//     },
//     {
//       string: navigator.vendor,
//       subString: "iCab",
//       identity: "iCab"
//     },
//     {
//       string: navigator.vendor,
//       subString: "KDE",
//       identity: "Konqueror"
//     },
//     {
//       string: navigator.userAgent,
//       subString: "Firefox",
//       identity: "Firefox"
//     },
//     {
//       string: navigator.vendor,
//       subString: "Camino",
//       identity: "Camino"
//     },
//     {    // for newer Netscapes (6+)
//       string: navigator.userAgent,
//       subString: "Netscape",
//       identity: "Netscape"
//     },
//     {
//       string: navigator.userAgent,
//       subString: "MSIE",
//       identity: "Explorer",
//       versionSearch: "MSIE"
//     },
//     {
//       string: navigator.userAgent,
//       subString: "Gecko",
//       identity: "Mozilla",
//       versionSearch: "rv"
//     },
//     {     // for older Netscapes (4-)
//       string: navigator.userAgent,
//       subString: "Mozilla",
//       identity: "Netscape",
//       versionSearch: "Mozilla"
//     }
//   ],
//   dataOS : [
//     {
//       string: navigator.platform,
//       subString: "Win",
//       identity: "Windows"
//     },
//     {
//       string: navigator.platform,
//       subString: "Mac",
//       identity: "Mac"
//     },
//     {
//       string: navigator.userAgent,
//       subString: "iPhone",
//       identity: "iPhone/iPod"
//     },
//     {
//       string: navigator.platform,
//       subString: "Linux",
//       identity: "Linux"
//     }
//   ]
// };

// BrowserDetect.init();





