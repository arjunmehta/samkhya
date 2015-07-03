// Scratchpad

// API

samsaara.connection(this.id).execute('something')(argA, argB);

var connection = samsaara.connection(this.id);
connection.execute('something')(argA, argB);

this.execute('something')(argA, argB);


// Groups

// Execute on a group's core namespace
samsaara.group('everyone').execute('something')(argA, argB);

// Execute on a group except certain connections
samsaara.group('everyone').except([this.id]).execute('something')(argA, argB);

// Execute on a specific namespace of a group
samsaara.group('everyone').namespace('this').execute('something')(argA, argB);

// Execute on a specific namespace of a group
samsaara.group('everyone').except([this.id]).namespace('this').execute('something')(argA, argB);

// Shortcut for everyone except connection
connection.broadcast('whatever')(argA, argB);

