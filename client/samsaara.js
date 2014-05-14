var samsaara = (function(samsaara){

  samsaara = new EventEmitter();

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

  var attributes = {initializedAttributes : {init: false} };

  attributes.force = function(attributeName){
    attributes.initializedAttributes[attributeName] = false;
  };

  attributes.initializedAttribute = function(attributeName){

    console.log("Initialized Attribute", attributeName);

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

  /**
   * Public Methods
   **/

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

  samsaara.expose = function(set){
    for(var func in set){
      exposedMethods[func] = set[func];
    }
  };

  samsaara.addInternalMethod = function(name, func){
    if(!internalMethods[name]){
      internalMethods[name] = func;
    }
  };

  samsaara.use = function(module){

    if(typeof module === "function"){
      module = module(samsaara, attributes);
    }

    console.log("Trying to use", module);

    if(module.internalMethods){
      for(var methodName in module.internalMethods){
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
      // console.log("initializationMethods", module.initializationMethods);
      for(var initMethod in module.initializationMethods){
        initializationMethods.push(module.initializationMethods[initMethod]);
      }
    }    
  };


  /**
   * Private/Public Methods
   **/

  var func = samsaara.func = function(fname){
    var args = arguments;
    var packet = {};    
    packet.func = fname;

    processAndSend(1, packet, args, samsaaraOwner);
  };

  var nsFunc = samsaara.nsFunc = function(ns, fname){
    var args = arguments;
    var packet = {};    
    packet.ns = ns;
    packet.func = fname;

    processAndSend(2, packet, args, samsaaraOwner);
  };


  /**
   * Private Methods
   **/

  function sendRaw(message){
    console.log("SENDING",message);
    lastBeat = heartBeatBeat;
    sockjs.send(message);
  }

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

  function send(packetJSON, owner, callBack){

    if(typeof callBack === "function"){
      var callBackID = makeIdAlpha(12);
      incomingCallBacks[callBackID] = {callBack: callBack};
      packetJSON.callBack = callBackID;
    }

    if(preinitialized === true){
      // packetJSON.token = samsaaraToken;
      // if(packetJSON.owner !== undefined && packetJSON.owner !== samsaaraOwner)
      sendRawWithHeaders( samsaaraOwner, {}, JSON.stringify(packetJSON) );  //    +":"+samsaaraToken+"::"
    }
    else{
      functionQueue.push( packetJSON );
    }
  }

  function nsSend(ns, packet, callBack){
    packet.ns = ns;
    send(packet, callBack);
  }

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


  function initSock(){

    sockjs = new SockJS(sockjs_url);

    sockjs.onopen = function(){
      console.log('[*] samsaara socket open', sockjs.protocol);

      sockConnectionTimerTime = 0;

      for(var i=0; i<initializationMethods.length; i++){
        initializationMethods[i]();
      }
    };

    sockjs.onmessage = function(e){
      var messageParsed = {};
      try{
        console.log("INCOMING MESSAGE", e.data);
        messageParsed = JSON.parse(e.data);           
      }
      catch(err){
        console.log(err);
      }
      evalMessage(messageParsed);
    };

    sockjs.onclose = function(e){
      console.log('[*] samsaara socket close');
      preinitialized = false;

      sockConnectionTimer = setTimeout(function(){
        var timeoutTime = sockConnectionTimerTime >= (15000/2) ? 15000 : (sockConnectionTimerTime*2 + 400);
        sockConnectionTimerTime = timeoutTime;

        initSock();
      }, sockConnectionTimerTime);
    };
  }

  function heartBeater(){
    if(lastBeat < heartBeatBeat - 1){
      sendRaw('H');
    }
    console.log("Beat Beat", lastBeat, heartBeatBeat);
    heartBeatBeat++;
  }

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
        console.log("Samsaara Error:", messageObj.func, "Is not a valid property of this Samsaara Object", messageObj);
        if(messageObj.callBack){
          send({ns: "internal", func: "callItBackError", args: [messageObj.callBack, messageObj.owner, ["ERROR: Invalid Object on Client"]]}, messageObj.owner);
        }
      }
    }

    if(messageObj.internal !== undefined){
      if(internalMethods[messageObj.internal] !== undefined){
        execute(internalMethods[messageObj.internal], messageObj);
      }
      else{
        console.log("Samsaara Error:", messageObj.internal, "Is not a valid property of this Samsaara Object");
      }
    }
  }


  messageRoutes.init = function(messageObj){
    if(messageObj.samsaaraHeartBeat){
      clearInterval(heartBeat);
      heartBeat = setInterval(heartBeater, messageObj.samsaaraHeartBeat);
    }
    if(messageObj.samsaaraID !== undefined){
      samsaaraID = messageObj.samsaaraID;
      console.log("CONNECTED AS:" + samsaaraID);
    }
    if(messageObj.samsaaraOwner !== undefined){
      samsaaraOwner = messageObj.samsaaraOwner;
      sendRawWithHeaders( samsaaraOwner, {}, JSON.stringify({opts: remoteOptions}) );
      console.log("samsaaraOwner:" + samsaaraOwner);
    }

    attributes.initializedAttribute("init");
  };

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

  function execute(func, messageObj){

    if(messageObj.callBack !== undefined){

      var callBackID = messageObj.callBack;
      var theCallBack = outgoingCallBacks[callBackID] = createCallBack(callBackID, messageObj.owner);

      if(messageObj.args === undefined){
        messageObj.args = [];
      }
      messageObj.args.push(outgoingCallBacks[callBackID]);
    }
    func.apply(samsaara, messageObj.args);
  }

  function createCallBack(id, owner){
    var theCallBack = function(){
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


  /**
   * Exposed Internal Methods
   **/

  internalMethods.callItBack = function(id, owner, args){
    // console.log("CALL IT BACK", id, owner, args);
    // console.log("CALL IT BACK", incomingCallBacks);
    incomingCallBacks[id].callBack.apply(incomingCallBacks[id].from, args);
    delete incomingCallBacks[id];
  };

  internalMethods.reportError = function(code, message){
    console.log("SAMSAARA SERVER ERROR:", code, message);
  };

  internalMethods.samsaaraInitialized = function(initialized, callBack){
    samsaara.emitEvent("initialized");
    if(typeof callBack === "function") callBack(true);
  };


  /**
   * Helper Methods
   **/

  function makeIdAlpha(idLength){
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    for( var i=0; i < idLength; i++ ){
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

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





