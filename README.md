Infant [![Build Status](https://travis-ci.org/nullivex/infant.png?branch=master)](https://travis-ci.org/nullivex/infant)
============

Start scaling your Node applications like the professionals do.

## Quick Clustered Application

This takes two files, `index.js` is our entry point and `worker.js`
contains the code for the application.
`index.js`
```js
var infant = require('infant').cluster
var cluster = infant.cluster('./mychild',{count: 2, enhanced: true})
var errorHandler = function(err){console.error(err); process.exit(1)}
cluster.start(function(err){
  if(err) return errorHandler(err)
  console.log('Cluster started!')
  cluster.stop(function(err){
   if(err) return erroHandler(err)
   console.log('Cluster stopped!')
  })
})
```
`worker.js`
```js
var http = require('http')
var worker = require('infant').worker
var server = http.createServer((req,res)=>{
  res.end('Hello!');
})
//setup the worker with advanced features
if(require.main === module){
  worker(server,
    //start
    function(done){server.listen(3000); process.nextTick(done)},
    //stop
    function(done){console.log('Stopped'); done()}
  )
}
```

Start the cluster

`node index`

Expected output

`Cluster Started!`

To stop the application from the foreground use "CTRL + C" infant handles all
the other signaling from the OS.

## What is Infant?

Infant is a helper package that wraps some of the core node modules that are
used to provide child process and cluster support.

This package comes with two main helpers **Child**, **Cluster** which provide 
enhanced functionality over the basic functionality that the core packages
provide. Additionally the **Lifecycle** helper is provided for organizing
complex startup and shutdown sequences with an init.d style interface.

Furthermore, Infant fixes some of the inherent problems with graceful startup
and shutdown that are not supported using the raw node modules.

Finally, Infant can be used as a drop in replacement for `child_process` and
for `cluster`. Additionally there are simple helpers included to enhance
children to communicate with the master and provide features such as:

* **Graceful Startup**
* **Graceful Shutdown**
* **Automatic Respawn**
* **Worker Recycling**

As this module relies heavily and mainly extends the core node modules. It
is imperative to get familiar with these documents as well

* [Child process](http://nodejs.org/api/child_process.html)
* [Cluster](http://nodejs.org/api/cluster.html)

## Usage

### Child

#### Calling a child process that runs forever

**Parent**
```js
'use strict';
var parent = require('infant').parent

var errorHandler = function(err){
  console.error(err)
  process.exit()
}

//instantiate the child (same as require('x'))
var child = parent('./myscript')

//start the child
child.start(function(err){
  if(err) return errorHandler(err)
  console.log('Child started successfully')
  //stop the child
  child.stop(function(err){
    if(err) return errorHandler(err)
    console.log('Child stopped successfully')
  })
})
```
**Child**

```js
'use strict';
var child = require('infant').child

if(require.main === module){
  child(
    'mychild', //child process title
    function(done){
      //startup operations
      done()
    },
    function(done){
      //shutdown operations
      done()
    }
  )
}
```

#### Calling a child process that runs once

**Parent**
```js
'use strict';
var parent = require('infant').fork

var errorHandler = function(err){
  console.error(err)
  process.exit()
}

//run the child
parent('./myscript',function(err){
  if(err) return errorHandler(err)
  console.log('Child completed successfully')
})
```
**Child**

```js
'use strict';
var child = require('infant').childOnce

if(require.main === module){
  child(
    'mychild', //child process title
    function(done){
      //script operations
      done()
    }
  )
}
```

### Cluster

#### Cluster with basic workers

**Parent**

```js
'use strict';
var cluster = require('infant').cluster

var master = cluster('./mychild')

var errorHandler = function(err){
  console.error(err)
  process.exit()
}

master.start(function(err){
  if(err) return errorHandler(err)
  console.log('cluster started')
  master.stop(function(err){
   if(err) return erroHandler(err)
   console.log('cluster stopped')
  })
})
```

**Child**

```js
'use strict';
var http = require('http')

var server = http.createServer((req,res)=>{
  res.end('foo')
})

server.listen(3000)
```

#### Cluster with enhanced workers

**Parent**

```js
'use strict';
var cluster = require('infant').cluster

var master = cluster('./mychild',{count: 4, enhanced: true})

var errorHandler = function(err){
  console.error(err)
  process.exit()
}

master.start(function(err){
  if(err) return errorHandler(err)
  console.log('cluster started')
  master.stop(function(err){
   if(err) return erroHandler(err)
   console.log('cluster stopped')
  })
})
```

**Child**

```js
'use strict';
var http = require('http')
var worker = require('infant').worker

var server = http.createServer((req,res)=>{
  res.end('foo')
})

//setup the worker with advanced features
worker(server)

server.listen(3000)
```

### Lifecycle helper

```js
'use strict';
var Lifecycle = require('infant').Lifecycle
var lifecycle = new Lifecycle()

//hook some events for logging
lifecycle.on('start',function(item){
  console.log('Starting ' + item.title)
})
lifecycle.on('stop',function(item){
  console.log('Stopping ' + item.title)
})
lifecycle.on('online',function(){
  console.log('Startup complete')
})
lifecycle.on('offline',function(){
  console.log('Shutdown complete')
})


//add a new startup accompanied by a shutdown
lifecycle.add(
  'step 1',
  function(done){
    //startup stuff
    done()
  },
  function(done){
    //shutdown stuff
    done()
  }
)

//start the members of the lifecycle
lifecycle.start(function(err){
  if(err) throw err
  lifecycle.stop(function(err){
    if(err) throw err
    //shutdown complete
  })
})
```

## API Reference

### Child

#### Constructor

* `module` - Takes an argument similar to require
* `options` - Optional bject of options

**Options**
* `respawn` - (boolean) defaults to true (restart the process on exit)
* `fork` - (object) options passed to `child_process.fork()` see the node
documentation

#### Child.prototype.status()

This function takes no arguments and returns the current status

**Status definitions**
* `dead` - Nothing running, not configured
* `starting` - Startup in progress
* `stopping` - Shutdown in progress
* `ready` - Process is ready to start
* `ok` - Process is running

#### Child.prototype.start(cb)

Takes only one argument, callback which is called `cb(err)` on process
startup completion. Errors bubble from the children.

#### Child.prototype.stop([timeout],cb)

Takes either a callback as the only parameter or a timeout in ms and a callback
which will shutdown the process without a kill timeout.

If timeout is omitted the process has an unlimited amount of time to shutdown.

#### Child.prototype.kill(signal)

This function is sync and forcefully kills the child. (`SIGTERM` by default)

This is also called automatically on any running process during
`process.on('exit')` with `SIGKILL`

#### Child.prototype.send(msg)

Send the child a message through the IPC.

Takes any data type for msg that can be serialized and passed to the child.

The child receives the message through the `process.on('message')` event.

#### Child.fork(module,options,cb)

This static function will execute a child that dies on completion of execution.
It is considered a one time child.

* `module` - (string) file name to use (similar to require('x'))
* `options` - (object) optional object of options
 * `respawn` - (boolean) respawn a failed process (default: `true`)
 * `timeout` - (number) kill the process after specified timeout
(default: `null`)
* `cb` - Called on completion with optional error `cb(err)`

**NOTE** If the callback is omitted the process will not be started and timeout
functionality will not be implemented. The instance of the Child object
is returned to be augmented manually.

#### Child.parent(module,options)

Shortcut for the main constructor

#### Child.child(title,start,stop)

This is a wrapper function for children to setup IPC communication for
graceful startup and shutdown. Use this only in the child.

* `title` - String that defines the process title
* `start` - Function that is called with a single parameter `done` which is a
callback that should be fired when startup is complete, can be passed an 
optional error as the only argument `done(err)`
* `stop` - Same as the start function, only used for shutdown.

#### Child.childOnce(title,exec)

This wrapper is similar to `Child.child` but is used to run process that
runs and exits immediately (childOnce)

* `title` - String that defines the process title
* `exec` - Same as the `start` function in `Child.child`

#### Child Events

* `status` - emitted when the status changes, args: `status` the new status
* `exit` - emitted when the child exits, args: `code` the exit code of the child
* `close` - emitted when the child closes
* `error` - emitted during an error, args: `err` the error
* `respawn` - emitted when the process respawns, args: `pid` the pid of the
new process
* `message` - emitted when the child process sends a message, args: `msg` the
message sent by the child

### Cluster

#### Constructor

The constructor only arms the instance, it should also be noted that this
class must be a singleton since a master can only maintain a single instance
of the `cluster` module.

That is why it is not exposed as the default operator, use
`require('infant').cluster` instead which takes the same parameters as this
constructor.

* `module` - File name to execute for workers (same as require('x'))
defaults to `process.argv[1]`
* `options` - optional bbject of options defined below

**Options**
* `enhanced` - (boolean) default false, enable enhanced worker mode
* `respawn` - (boolean) default true, enabled worker respawn on unexpected exit
* `respawnDelay` - (number) default 15000, milliseconds before respawning a process
* `count` - (number) number of workers to start, defaults to `os.cpus().length`
* `maxConnections` - (number) only available in enhanced mode, but will cause
a worker to be shutdown and a new one started (recycled) when the worker
achieves maxConnections. The default value is 1000000.
* `maxMemoryGain` - (number) a percent value 1-n that quantifies the amount of
memory that can be gained since process startup before triggering a process
recycle. The default value is 1000.
* `stopTimeout` - (number) Timeout in `ms` to wait for workers to stop, defaults
to no timeout when in enhanced mode, however it defaults to `5000` in normal
mode.
* `recycleTimeout` - (number) Timeout in `ms` to wait for a worker to stop when
it is being recycled, similar to stopTimeout, defaults to `5000` and must be 
defined
* `execArgv` - (array) passed through to `cluster.setupMaster()` see the node
documentation
* `silent` - (boolean) passed through to `cluster.setupMaster()` see the node
documentation
* `args` - (array) passed through to `cluster.setupMaster()` see the node
documentation
* `env` - (object) passed through to `cluster.fork(env)` see the node
documentation

#### Cluster.prototype.each(cb)

Execute a callback on each worker that is currently running.

* cb - This callback is executed `cb(worker)`

#### Cluster.prototype.send(msg)

Send each worker in the cluster the msg defined as `msg`

#### Cluster.prototype.fork()

Start a new worker which will be boot strapped with advanced features in
enhanced mode

#### Cluster.prototype.setupWorker(worker)

This is an internal function that is used to add enhanced functionality to
workers such as recycling.

#### Cluster.prototype.start(cb)

Start the cluster and call `cb(err)` when the cluster is online.

#### Cluster.prototype.stop(db)

Stop the cluster and call `cb(err)` when the cluster is offline.

#### Cluster.prototype.restart(cb)

Restart the cluster and call `cb(err)` when complete.

#### Cluster.prototype.respawn(worker,code,signal)

This is an internal function used to respawn workers on unexpected exit

#### Cluster.prototype.kill(signal)

Kill all the workers with the given `signal` defaults to `SIGTERM`

#### Cluster.setup(server,title,start,stop)

* `server` - (HTTP) Instance of HTTP server to be extended
* `title` - (string) Process title
* `start` - (function) startup function passed `done(err)`
* `stop` - (function) shutdown function passed `done(err)`

Take an instance of the node HTTP server and wire to use enhanced features
with the master, this should only be called in the child.

Also implements graceful startup and shutdown.

It is alias as `require('infant').worker`

### Cluster Events

* `online` - Emitted any time a new worker comes online, args: `worker`
* `recycle` - Emitted when a worker is recycled, args: `worker`,
`connectionCount`
* `started` - Emitted on cluster start
* `exit` - Emitted any time a worker exits, args: `worker`, `code`, `signal`
* `respawn` - Emitted when a worker respawns, args: `worker, `code, `signal`
it should be noted that `worker` is the new worker, while `code` and `signal`
are from the previous workers exit
* `stopping` - Emitted on beginning of cluster shutdown
* `stopped` - Emitted on completion of cluster shutdown

### Lifecycle

#### Constructor

Takes no arguments, returns a new lifecycle instance

#### Lifecycle.prototype.add(title,start,stop)

Title is a string that will be provided during events

Where start and stop are functions that are passed a `done(err)` callback

#### Lifecycle.prototype.remove(title)

Remove the member from the lifecycle, using the title to identify the member

#### Lifecycle.prototype.start(done)

Will start all the members in the order they were added and call `done(err)`
when complete.

#### Lifecycle.prototype.stop(done)

Will stop all the members in reverse order that they were added and call
`done(err)` when complete.

#### Lifecycle Events

* `add` - Emitted when a member is added, args: `item` the item being
added
* `remove` - Emitted when a member is removed, args: `item` the item being
removed
* `start` - Emitted when a member is started, args: `item` the item being
started
* `stop` - Emitted when a member is stopped, args: `item` the item being
stopped
* `online` - Emitted when the startup sequence is complete
* `offline` - Emitted when the shutdown sequence is complete

## Debugging

It is useful to see the inter process communication for debugging and just
overall feel that the system is working.

This package is built using the https://www.npmjs.org/package/debug package.

Use the following to see debug output

```
$ DEBUG=infant* node app
```

## Changelog

### 1.3.0
* Worker recycle now emits SIGHUP to assist in gracefully shutting down overly
 ripe workers.
* Worker recycle can now be done by either memory usage limits, connection
 limits or both. This will allow processes to restart less often when there is
 no reason to issue a recycle. For memory hungry applications using a connection
 limit will still make more sense. A combination approach is the default, which
 will look for a resident to double its size from startup or reach 1,000,000
 connections.
* Decrease heartbeat frequency to 10 seconds over the previous value of 1 second.
* Increase delay before restarting broken processes from 1 second to 15 seconds.
* Use latest dependencies.

### 1.2.4
* Remove debug messaging on heartbeat messages to workers.
* Remove SIGUSR2 handling, `nodemon` applications should use `--signal SIGINT`

### 1.2.3
* Fix small issue with nodemon integration and only listen for `SIGUSR2` once.

### 1.2.2
* Add compatibility with the `nodemon` `SIGUSR2` shutdown signal.

### 1.2.1
* Increase heartbeat timeout 8 times to better handle high load.

### 1.2.0
* Critical signaling fix to Child.js that will handle shutdown properly
by ignoring SIGINT and SIGTERM calls in children. SIGHUP will bring down
children gracefully even without master saying so, however the master will
probably spawn new children. Thus, this the SIGHUP feature is used for config
reload.

### 1.1.1
* README example code updates.

### 1.1.0
* Update to latest dependencies
* Update README to be more friendly
* Fix bug with Node version recognition causing issues with Node 10
* Add worker suicide when master communication is lost
* More robust tests

### 1.0.0
* Update dependencies and tests to work with latest Node.js versions.
* This release also drops testing support of Node.js < 4.x (however infant should still work!)
* Official 1.0.0 stable release. Infant has been in production for 2 years and served billions of requests.

### 0.12.1
* More bug fixes to make infant work across all major node versions.
* Hold down timer added to respawn to prevent zombie processes stacking up.

### 0.12.0
* Upgraded to work with the latest node versions and be backwards compatible.

### 0.11.1
* Kill child processes on timeout rather than term

### 0.11.0
* Better process stop handling

### 0.10.0
* Upgraded dependencies
* Working with node 4.x
* Added a workaround to work with node 0.12.x +
* Fixed an issue with sending messages to workers who are not listening
* This version is no longer compatible with node 0.10

### 0.9.5
* Bug fix to address using absolute paths on Windows and child resolution.
* Added test against windows absolute paths
* Bump dependencies

### 0.9.4
* Improved debug logging on recycling
* Now deletes worker connection counters after recycling (prevent mem leaks)

### 0.9.3
* Added more verbosity to worker recycle
* Changed logs to always reference the workers pid
* Fixed bug where worker would try to send a request notification even if the
master was already disconnected.

### 0.9.1
* Fixed a bug where worker recycle wasnt properly using `worker.disconnect()`
to ensure that all existing connections are handled properly.
* Also fixes an issue where two or more workers would be restarted each time
one is recycled.

### 0.9.0
* Now passes construction options to Child.fork()

### 0.8.5
* Fixed: Worker helper should output a usable error when an invalid server is passed
* Fixed: Callback already called error

### 0.8.4
* Cleaned up debug to no longer use `oose` labeling

### 0.8.3
* Fixes #1 where complex errors wouldnt bubble upwards for child and cluster
* Fixes bug with option handling in `Child.fork()`
* Adds `env` to options in order to pass environment variables to any calls to
`cluster.fork()`
* Adds respawn control to `Cluster` helper

### 0.8.2
* Dependency for `async` was in `devDependencies`

### 0.8.1
* Lifecycle will only call items with registered start or shutdown handlers

### 0.8.0
* Lifecycle helper now takes an optional name
* Lifecycle helper is now an event emitter (useful for loggin)
* Added tests against the Lifecycle helper
* There is a breaking change to the lifecycle helper, where removals require
the title to be specified

### 0.7.0
* Improved worker setup helper to include graceful startup and shutdown
* Child.fork now supports timeouts on runOnce processes

### 0.6.0
* Lots of documentation cleanup
* `require('infant').Cluster` now available for raw class access
* Added Lifecycle helper for building startup and shutdown sequences

### 0.5.0

* Initial release after extraction from oose.io
