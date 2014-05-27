function Project(){

}

Project.prototype.depend = function(){};
Project.prototype.depender = function(){};


// before developing a new module, consider the most central existing modules currently.
// core, groups, ipc, contexts, identity, access



// server

samsaara.initialize();
samsaara.use( middlewareName({optionA: "setting"}) );

samsaara.expose({
  methodA: methodA,
  methodB: methodB
});


// namespace interaction
/*
Namespace/field:
- local (!) you must expose functions on all processes  in the same way to share functionality.
- hold various methods to execute
- methods can have their own context
- unidirectional (client to server)
- vague, but contained within context (ie. global, or context)
- the field of action (the organs of action)
- this: a method executed in a namespace has this is the executor
*/

samsaara.createNamespace(nameSpace);
samsaara.createNamespace(nameSpace, {method: method});
samsaara.nameSpace(nameSpace).expose({});

function createNamespace(nameSpaceName, methods){
  nameSpaces[nameSpaceName] = new NameSpace(nameSpaceName, methods);
}

function nameSpace(nameSpaceName){
  return nameSpaces[nameSpaceName];
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


// client interaction
/*
Clients:
- local OR symbolic
- hold information about the connected client
- a single "user" can have multiple clients/connections
- unidirectional (server to clients)
- execute on clients
- return results as individual callbacks
- portal to the user and their connected device
- this: callbacks: this is the client/"executor" of the callback
*/

samsaara.client(clientID).execute();
samsaara.client(clientID).disconnect();

samsaara.client(clientID).attribute("geolocation", function(attribute){});
samsaara.client(clientID).attributes(["geolocation", "windowSize"], function(attributes){});

samsaara.client(clientID).local();


// group interaction
/*
Groups:
- global (existence of groups is synchronized on all processes) // ??????????? What about context groups? Maybe there ought to be LocalGroups and GlobalGroups?
- lists
- global lists
- unidirectional (server to clients)
- execute on clients
- return results as individual callbacks
- this: callbacks: this is the client/"executor" of the callback
*/

samsaara.createGroup(groupName);
samsaara.createGroup(groupName, [members]);

samsaara.createGlobalGroup(groupName); // default
samsaara.createLocalGroup(groupName); // useful for contexts/local sets of connections

samsaara.group(groupName).add();
samsaara.group(groupName).remove();

samsaara.group(groupName).execute();



// context interaction

/*
Contexts:
- local
- shares a resource, or sets of resources
- have their own contextual namespace
- can have subcontexts
- can have their own groups, namespaces and access
- unidirectional (client to server)
- this: this is a "complex executor". the context is accessed by this.content, its "resource" is this.resource or this.context.resource, "executor/client" is this.executor,
*/

samsaara.createContext(contextID);
samsaara.createContext(contextID, {} || function(){});

samsaara.context(contextID).add(connection, callBack);
samsaara.context(contextID).remove(connection, callBack);


// ensure this is done at the time of context creation otherwise you may get context existence errors (as this may be called from other processes)

samsaara.context(contextID).expose({
  depend: project.depend,
  depender: project.depender
});

samsaara.context(contextID).createNamespace(nameSpace, {});



function createContext(contextID, resource){
  contexts[contextID] = new Context(contextID, resource);
}


function Context(contextID, resource){

  this.contextID = this.id = contextID;

  this.nameSpaces = {};
  this.contexts = {};

  this.count = 0;
  this.members = {};
  this.resource = resource;

  if(samsaara.capability.groups === true){
    this.groups = {};
  }

}

Context.prototype.add = function(connection){
  if(this.members[connection.id] === undefined){
    this.count++;
    this.members[connection.id] = true;
  }
};

Context.prototype.remove = function(connection){
  if(this.members[connection.id] !== undefined){
    this.count--;
    this.members[connection.id] = undefined;
  }
};

Context.prototype.createContext = function(contextID, resource){
  samsaara.createContext(contextID, resource);
  this.contexts[contextID] = samsaara.contexts[contextID];
};

Context.prototype.createNamespace = function(nameSpaceName, exposed){
  samsaara.createNamespace(this.contextID+"_"+nameSpaceName, exposed);
  this.nameSpaces[nameSpaceName] = samsaara.nameSpaces[this.contextID+"_"+nameSpaceName];
};


if(samsaara.capability.groups === true){
  Context.prototype.createGroup = function(groupName){
    samsaara.createLocalGroup(this.contextID+"_"+groupName);
    this.groups[groupName] = samsaara.groups[this.contextID+"_"+groupName];
  };

  Context.prototype.group = function(groupName){
    return this.groups[groupName];
  };
}


// thought: if method is not listed in access, should access be granted? Or denied?
// that is why the method name is called restrict. Anything unrestricted will be accessible.



var context = samsaara.createContext(projectID, project);
context.createGroup();
context.createAccess();
context.createNamespace();

this.namespace(name).createAccess();



samsaara.context(contextID).execute();


  // context groups

  samsaara.context(contextID).createGroup();
  
  samsaara.context(contextID).group();

  samsaara.context(contextID).group().execute("getGeoposition", function(geoposition){});
  samsaara.context(contextID).group().add();
  samsaara.context(contextID).group().remove();


  // subcontexts

  samsaara.context(contextID).context(subContextID).execute(); // ???? This would be amazing
  samsaara.context(contextID).context(subContextID).group().execute(); // ???? This would be amazing


  // namespaces

  samsaara.context(contextID).createNamespace(nameSpace, {}).execute(); // ???? This would be amazing
  samsaara.context(contextID).context(subContextID).group().execute(); // ???? This would be amazing


// What about prototype contexts? .... what about them? "Prototype" contexts?? What are prototype contexts?



// access interaction
/*
Access:
- local
- allows the checking of a permission value for a specific __method__ of an object, and if so, returns the object, else returns {methodName: function(){}}.
- hasAccess should be added as a prototype value for object constructors.
- ***requires identity.
- evaluating access can be costly. The first time access is evaluated on a method for a connection, it is thereafter cached. So you'll notice less of a performance impact if the same connections are accessing the methods
*/

samsaara.createAccess("accessName", {users: userIDArray, groups: groupNameArray});
var access = samsaara.access(accessName);
// OR 
var access = samsaara.createAccess("accessName", {users: userIDArray, groups: groupNameArray});

access.addUser(userID);
access.removeUser(userID);

access.addGroup(samsaara.context(contextID).group(groupName));
access.removeGroup(samsaara.context(contextID).group(groupName));


  // restricting

  // restrict namespaces (execution)
  samsaara.restrict(samsaara.nameSpace("nameSpace"), ["execute"], access);
  // gets all connections currently under users and groups, adds the namespace to their access list (phew).
  // on new connection LOGIN, checks userID list/groups adds namespaces to their access list.
  // cross reference index? yikes. memory issue.

  // restrict contexts (joining/root execution)
  samsaara.restrict(samsaara.context("contextID"), ["add", "execute"], access);

  // restrict groups (joining/execution)
  samsaara.restrict(samsaara.group("groupName"), ["add", "execute"], access);


  // checking access

  // groups
  samsaara.group(groupName).hasAccess(connection, "execute").execute();
  samsaara.group(groupName).hasAccess(connection, "add").add(clientID);

  // namespaces
  samsaara.nameSpace(nameSpace).hasAccess(connection, "execute").execute(); // could also be done

  // contexts
  samsaara.context(contextID).hasAccess(connection, "add").add(clientID);
  samsaara.context(contextID).hasAccess(connection, "execute").execute();



function AccessList(accessObject){
  if(samsaara.capability.identity === true && accessObject.users){
    this.users = arrayToObject(accessObject.users || []);
  }
  if(samsaara.capability.groups === true && accessObject.groups){
    this.groups = arrayToObject(accessObject.groups || []);
  }
}


function arrayToObject(array){
  var object = {};
  for (var i = 0; i < array.length; i++) {
    object[array[i]] = true;
  }
  return object;
}

if(samsaara.capability.identity === true){
  AccessList.prototype.addUser = function(userID){
    this.users[userID] = true;
  };
  AccessList.prototype.removeUser = function(userID){
    delete this.users[userID];
  };

  AccessList.prototype.addUsers = function(userIDArray){
    for (var i = 0; i < userIDArray.length; i++) {
      this.users[userIDArray[i]] = true;
    }
  };
  AccessList.prototype.removeUsers = function(userIDArray){
    for (var i = 0; i < userIDArray.length; i++) {
      delete this.users[userIDArray[i]];
    }
  };
}

if(samsaara.capability.groups === true){
  AccessList.prototype.addGroup = function(groupName){

  };
  AccessList.prototype.removeGroup = function(groupName){

  };

  AccessList.prototype.addGroups = function(groupNameArray){

  };
  AccessList.prototype.removeGroups = function(groupNameArray){

  };
}


// user ID list should not be very long. The more users you give access to, the more memory will be used to store the list.
// if you want to check against large lists, you should use reusable groups, and instead add/remove the user to a group if they have access




function restrict(object, methodArray, access){
  object.hasAccess = hasAccess;
  var samsaaraAccess = object.samsaaraAccess = {};
  for (var i = 0; i < methodArray.length; i++) {
    samsaaraAccess[methodArray[i]] = access;
  }
}


samsaara.on("addedToGroup", function(connection, groupName){
  if(accessGroups[groupName]){
    for(var access in accessGroups[groupName]){
       accessGroups[groupName][access][connection.userID] = true;
    }
  }
});


// local method execution
function hasAccess(connection, methodName){

  var connectionAccess = connection.access[this.id + methodName];

  // if access is cached on this connection

  if(connectionAccess === true){
    return this;
  }
  if(connectionAccess === false){
    return createDud(methodName);
  }

  var methodAccess = this.samsaaraAccess[methodName];

  if(methodAccess === undefined){
    connection.access[this.id + methodName] = true; // cache access
    return this;
  }
  else{
    if(methodAccess.users){
      if(methodAccess.users[connection.getAttribute("userID")]){
        connection.access[this.id + methodName] = true; // cache access
        return this;
      }
    }
    if(methodAccess.groups){
      for (var i = 0; i < connection.groups.length; i++) {        
        if(methodAccess.groups[connection.groups[i]]){
          connection.access[this.id + methodName] = true; // cache access
          return this;
        }
      }
    }
  }

  connection.access[this.id + methodName] = false;
  return createDud(methodName);
  
}

function createDud(methodName){
  var dud = {};
  dud[methodName] = function(){};
  return dud;
}


// remote method execution access control (namespaces)

if(connection.access.nameSpaces[namespace]){

}


// OR

if(nameSpace.hasAccess(connection, "")){

}


// things like context groups are easy locally
// foreign objects though...

// symbolic context().group()

// it gets really tricky when you want to do this
var isProjectEqualContextResource = (samsaara.context(contextID).resource === project); // not possible on foreign hosts

// but what about 
samsaara.context(contextID).execute("someSpecialFunction");




// client
samsaara.namespace(namespaceName).execute();
samsaara.context(contextID).execute();
samsaara.execute();

samsaara.context(projectID).sendToGroup();


// there are local, foreign and distributed objects (could be multiply foreign, and local) as well as non-existent (neither local nor foreign nor distributed)