var self;

var Samsaara = function (opts){

  self = this;

  this.extendAsEventDispatcher();

  var options = opts;
  var remoteOptions = {};

  var outgoingCallBacks = {};
  var incomingCallBacks = {};

  this.sockjs_url = '/echo';
  this.preinitialized = false;

  this.functionQueue = []; //holds queued function calls that are called before full initialization

  this.navInfo = {
    browserName: BrowserDetect.browser,
    browserVersion: BrowserDetect.version,
    OSName: BrowserDetect.OS,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    vendor: navigator.vendor,
    language: navigator.language,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    pixelRatio: window.devicePixelRatio || 1,
    timeOffset: 0
  };

  if(localStorage.originalID !== ""){
    this.navInfo.originalID = localStorage.originalID;
  }

  this.callItBack = function(id, owner, args){
    // console.log("CALL IT BACK", id, owner, args);
    // console.log("CALL IT BACK", incomingCallBacks);
    incomingCallBacks[id].callBack.apply(incomingCallBacks[id].from, args);
    delete incomingCallBacks[id];
  };

  //ToDO Unniversal Transmit without Object in call
  this.func = function(fname){
    var args = arguments;
    var packet = {};
    packet.func = fname;

    if(args.length > 1){
      packet.args = [];
      for(var i = 1; i < args.length-1; i++){
        packet.args.push(args[i]);
      }
      if(typeof args[args.length-1] == "function"){
        self.send(packet, args[args.length-1]);
      }
      else{
        packet.args.push(args[args.length-1]);
        self.send(packet);
      }
    }
    else{
      self.send(packet);
    }
  };

  function callbackClosure(temp){
  return function(results, done){
    console.log ("ALERTS",results);
    temp.status = results.toString();
    done();
  };
}

  // this.sendRoute = function(packet){

  //   var message;
  //   if(packet.func !== undefined){
  //     if(packet.func !== "calItBack"){
  //       message = ["F", self.samsaaraToken, packet.func, packet.args, packet.callBack ];
  //     }
  //     else{
  //       message = ["C", self.samsaaraToken, packet.args[0], packet.args[1], packet.args[2] ];        
  //     }
  //   }
  //   self.sockjs.send( JSON.stringify(message) );
  // }

  // this.sendCallBack = function(id, owner, args){
  //   var message = ["C", self.samsaaraToken, id, owner, args ];
  // }


  this.nsSend = function(ns, packet, callBack){
    packet.ns = ns;
    self.send(packet, callBack);
  };

  this.send = function(packet, callBack){

    var packetJSON = packet;

    if(callBack !== undefined && typeof callBack === "function"){
      var callBackID = makeIdAlpha(12);
      incomingCallBacks[callBackID] = {callBack: callBack};
      packetJSON.callBack = callBackID;
    }

    if(self.preinitialized === true){
      packetJSON.token = self.samsaaraToken;
      self.sockjs.send( JSON.stringify(packetJSON) );
    }
    else{
      self.functionQueue.push( packetJSON );
    }
  };

  this.heartBeater = function(){
    self.sockjs.send('H');
  };

  this.sendPrepared = function(packetJSON){
    packetJSON.token = self.samsaaraToken;
    self.sockjs.send( JSON.stringify(packetJSON) );
  };

  this.reportError = function(code, message){
    console.log("ARGYLE SERVER ERROR:", code, message);
  };

  this.testTime = function(stopTime, serverTime, callBack){
    var serverOffset = serverTime - stopTime;
    var theTime = getCurrentTime();
    var errorDifference = theTime - serverOffset;

    if(callBack && typeof callBack === "function") callBack(serverTime, theTime, errorDifference);
  };

  this.updateOffset = function(timeOffset){
    console.log("Samsaara: updateOffset():", timeOffset);
    self.navInfo.timeOffset = timeOffset;
  };

  this.getNavInfo = function(callBack){
    if(callBack && typeof callBack === "function") callBack( self.navInfo );
  };

  this.addToGroups = function(callBack){
    if(callBack && typeof callBack === "function") callBack( options.groups );
    //self.send( {func:"addToGroup", args:[self.groups] } );
  };

  this.getGeoLocation = function(callBack){
    if (navigator.geolocation){
      navigator.geolocation.getCurrentPosition(function (position){
        self.navInfo.geoposition = position;
        if(callBack && typeof callBack === "function") callBack(null, self.navInfo.geoposition);
      }, function(err){
        if(callBack && typeof callBack === "function") callBack(err, null);
      });
    }
  };

  this.getWindowSize = function(callBack){
    if(callBack && typeof callBack === "function") callBack(window.innerWidth, window.innerHeight);
  };

  if(opts){
    if(opts.geoLocation){
      remoteOptions.geoLocation = opts.geoLocation;
    }
    if(opts.timeOffset){
      remoteOptions.timeOffset = opts.timeOffset;
    }
    if(opts.groups){
      remoteOptions.groups = opts.groups;
    }
    if(opts.windowSize){
      remoteOptions.windowSize = opts.windowSize;
      window.onresize = function(e){
        self.send( {func:"windowResize", args:[window.innerWidth, window.innerHeight] } );
      };
    }
    if(opts.socksURL){
      self.sockjs_url = opts.socksURL;
    }
  }

  this.sockjs = {};
  this.heartBeat = {};
  this.initEvent = new Event('initialized');


  this.initSock = function(sessionInfo){

    self.sockjs = new SockJS(self.sockjs_url);

    console.log("Session INFO:", sessionInfo);

    //ON OPEN
    self.sockjs.onopen = function(){
      console.log('[*] open', self.sockjs.protocol);

      clearInterval(self.heartBeat);
      self.heartBeat = setInterval(self.heartBeater, 10000);

      self.navInfo.sessionInfo = sessionInfo;

      if(options && options.session){
        // self.sockjs.send( JSON.stringify( { login: sessionInfo } ));

        console.log("*******************ATTEMPTING TO LOG IN SESSION");

        self.send({func: "requestLoginToken"}, function (err, registrationToken){
          httpGet("/registerConnection?regtoken=" + registrationToken, function (sessionInfo){
            self.navInfo.sessionInfo = sessionInfo;
            self.sockjs.send( JSON.stringify( { login: [registrationToken, sessionInfo] } ));
          });
        });
      }

      self.sockjs.send( JSON.stringify( { opts: remoteOptions } ));

    };

    //ON MESSAGE
    self.sockjs.onmessage = function(e){
      var messageObj = JSON.parse(e.data);
      self.evalMessage(messageObj);
    };

    //ON CLOSE
    self.sockjs.onclose = function(e){
      console.log('[*] close');

      if(self.navInfo.sessionInfo){
        self.initSock(sessionInfo);
      }
      else{ self.initSock("unsessioned"); }
    };
  };


  //getSessionID and userName and on callback initialized
  self.initSock({id: "anon" + makeIdAlpha(15), name: "user" + makeIdAlpha(15)});



  this.evalMessage = function (messageObj){

    if(messageObj.samsaaraID){

      self.samsaaraID = messageObj.samsaaraID;

      console.log("localstorage.originalID",  localStorage.originalID);
      console.log("self.navInfo.originalID",  self.navInfo.originalID);

      if(self.navInfo.originalID === undefined || localStorage.originalID === undefined){
        self.navInfo.originalID = self.samsaaraID;
        localStorage.originalID = self.samsaaraID;
      }

      console.log("CONNECTED AS:" + self.samsaaraID);
    }

    if(messageObj.samsaaraToken){
      self.samsaaraToken = messageObj.samsaaraToken;
      console.log("Token Received:", self.samsaaraToken);

      if(!self.preinitialized){
        self.preinitialized = true;
        if(self.functionQueue.length > 0){
          for(var i=0; i < self.functionQueue.length; i++){
            self.send( self.functionQueue[i] );
          }
          self.functionQueue = [];
        }
      }
    }


    if(messageObj.func){

      if(validProperty(messageObj.func, self)){

        //handle client callbacks via a callback id that is stored and sent back to the client with new arguments

        if(messageObj.callBack){

          var callBackID = messageObj.callBack;

          //console.log(messageObj.func, "CALLBACK FROM SERVER Id:", messageObj.callBack, "Owner:", messageObj.owner);

          outgoingCallBacks[callBackID] = function(){
            var args = Array.prototype.slice.call(arguments);
            eval("var owner = '" + messageObj.owner + "';");
            eval("var id = '" + callBackID + "';");
            self.send({func: "callItBack", args: [id, owner, args] } );

            delete outgoingCallBacks[id];
          };

          if(!messageObj.args){
            messageObj.args = [];
          }

          messageObj.args.push(outgoingCallBacks[callBackID]);
        }

        self[messageObj.func].apply(this, messageObj.args);

      }
      else{
        console.log("Samsaara Error:", messageObj.func, "Is not a valid property of this Samsaara Object");
      }
    }
  };
};


Samsaara.prototype.samsaaraInitialized = function(whichOne, callBack){
  self.dispatchEvent(self.initEvent);
  if(callBack && typeof callBack === "function") callBack(whichOne);
};

Samsaara.prototype.updateToken = function(oldToken, newToken, callBack){
  if(self.samsaaraToken == oldToken){
    self.samsaaraToken = newToken;
    if(callBack && typeof callBack === "function") callBack(newToken);
  }
};

Samsaara.prototype.extendAsEventDispatcher = function(){
  if (this._listeners == null){
    this._listeners = [];
  }
  this.isEventDispatcher = true;

  if (typeof(this.dispatchEvent) == "undefined"){
    this.dispatchEvent = function(eventObject){
      for ( var i = 0; i < this._listeners.length; i++){
        var test = this._listeners[i];
        if (test.type === eventObject.type){
          test.callback(eventObject);
          break;
        }
      }
    };
  }

  if (typeof(this.addEventListener) == "undefined"){
    this.addEventListener = function (type, callback, capture){
      // no dupes
      var declared = false;
      for ( var i = 0; i < this._listeners.length; i++){
        var test = this._listeners[i];
        if (test.type === type && test.callback === callback){
          declared = true;
          break;
        }
      }

      if (!declared){
        this._listeners.push({'type':type,'callback':callback,'capture':capture});
      }
    };
  }
};


//SUPPORTING FUNCTIONS////////////////////////////////////////////////////////////////////////////

function validProperty(propName, whichOne){
  try{
    return whichOne[propName];
  }
  catch (err){
    return false;
  }
}

function getCurrentTime(){
  var currentTime = new Date().getTime();
  return currentTime;
}


//Browser Detect Script: http://www.quirksmode.org/js/detect.html

var BrowserDetect = {
  init: function () {
    this.browser = this.searchString(this.dataBrowser) || "An unknown browser";
    this.version = this.searchVersion(navigator.userAgent) || this.searchVersion(navigator.appVersion) || "an unknown version";
    this.OS = this.searchString(this.dataOS) || "an unknown OS";
  },
  searchString: function (data) {
    for (var i=0;i<data.length;i++)  {
      var dataString = data[i].string;
      var dataProp = data[i].prop;
      this.versionSearchString = data[i].versionSearch || data[i].identity;
      if (dataString) {
        if (dataString.indexOf(data[i].subString) != -1)
          return data[i].identity;
      }
      else if (dataProp)
        return data[i].identity;
    }
  },
  searchVersion: function (dataString) {
    var index = dataString.indexOf(this.versionSearchString);
    if (index == -1) return;
    return parseFloat(dataString.substring(index+this.versionSearchString.length+1));
  },
  dataBrowser: [
    {
      string: navigator.userAgent,
      subString: "Chrome",
      identity: "Chrome"
    },
    {
       string: navigator.userAgent,
      subString: "OmniWeb",
      versionSearch: "OmniWeb/",
      identity: "OmniWeb"
    },
    {
      string: navigator.vendor,
      subString: "Apple",
      identity: "Safari",
      versionSearch: "Version"
    },
    {
      prop: window.opera,
      identity: "Opera",
      versionSearch: "Version"
    },
    {
      string: navigator.vendor,
      subString: "iCab",
      identity: "iCab"
    },
    {
      string: navigator.vendor,
      subString: "KDE",
      identity: "Konqueror"
    },
    {
      string: navigator.userAgent,
      subString: "Firefox",
      identity: "Firefox"
    },
    {
      string: navigator.vendor,
      subString: "Camino",
      identity: "Camino"
    },
    {    // for newer Netscapes (6+)
      string: navigator.userAgent,
      subString: "Netscape",
      identity: "Netscape"
    },
    {
      string: navigator.userAgent,
      subString: "MSIE",
      identity: "Explorer",
      versionSearch: "MSIE"
    },
    {
      string: navigator.userAgent,
      subString: "Gecko",
      identity: "Mozilla",
      versionSearch: "rv"
    },
    {     // for older Netscapes (4-)
      string: navigator.userAgent,
      subString: "Mozilla",
      identity: "Netscape",
      versionSearch: "Mozilla"
    }
  ],
  dataOS : [
    {
      string: navigator.platform,
      subString: "Win",
      identity: "Windows"
    },
    {
      string: navigator.platform,
      subString: "Mac",
      identity: "Mac"
    },
    {
      string: navigator.userAgent,
      subString: "iPhone",
      identity: "iPhone/iPod"
    },
    {
      string: navigator.platform,
      subString: "Linux",
      identity: "Linux"
    }
  ]
};

BrowserDetect.init();




function checkDifference(a, b){
  if(a == b){
    return false;
  }
  else{
    return true;
  }
}



function getScreenInfo(){

  var displayObject = {};

  displayObject.screenX = window.screenX;
  displayObject.screenY = window.screenY;

  displayObject.displayWidth = window.screen.width;
  displayObject.displayHeight = window.screen.height;

  displayObject.displayAvailWidth = window.screen.availWidth;
  displayObject.displayAvailHeight = window.screen.availHeight;

  displayObject.displayAvailLeft = window.screen.availLeft;
  displayObject.displayAvailTop = window.screen.availTop;

  displayObject.innerWidth = window.innerWidth;
  displayObject.innerHeight = window.innerHeight;

  displayObject.outerWidth = window.outerWidth;
  displayObject.outerHeight = window.outerHeight;

  if(self.navInfo.displayCalibrated){
    displayObject.calibratedX = self.navInfo.displayCalibrated.X;
    displayObject.calibratedY = self.navInfo.displayCalibrated.Y;
  }

  displayObject.totalDisplayWidth = 0;

}

function GetHeight(){
  var y = 0;
  if (self.innerHeight){ y = self.innerHeight; }
  else if (document.documentElement && document.documentElement.clientHeight){ y = document.documentElement.clientHeight;  }
  else if (document.body){ y = document.body.clientHeight; }
  return y;
}


function httpGet(theUrl, callBack){
  var xmlHttp = null;

  xmlHttp = new XMLHttpRequest();
  xmlHttp.open( "GET", theUrl, false );
  xmlHttp.send( null );

  if(callBack) callBack(xmlHttp.responseText);
  else return xmlHttp.responseText;
}


function makeIdAlpha(idLength){
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  for( var i=0; i < idLength; i++ ){
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}