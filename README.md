node-samsaara
==========

A comprehensive module to create, maintain and manage active socket connections.

```bash
npm install samsaara
```

```javascript
var app = express();
var server = http.createServer(app);

var samsaara = require('samsaara');
samsaara.initialize(server, app);
```


## Middleware

```javascript
var groups = require('samsaara-groups');
var authentication = require('samsaara-authentication');

samsaara.use(groups());
samsaara.use(authentication({strict: true}));
```