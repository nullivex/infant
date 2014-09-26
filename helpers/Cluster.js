'use strict';
var debug = require('debug')('infant:Cluster')
var EventEmitter = require('events').EventEmitter
var ObjectManage = require('object-manage')
var os = require('os')
var Q = require('q')

var util = require('./util')

var instance


/**
 * Emergency shutdown handler
 */
process.on('exit',function(){
  if(instance) instance.kill('SIGKILL')
})



/**
 * Setup a new worker control instance
 * @param {string} module
 * @param {options} options
 * @constructor
 */
var Cluster = function(module,options){
  EventEmitter.call(this)
  //allow file to be the options
  if('object' === typeof module){
    options = module
    module = null
  }
  //default to the process argv for file
  module = module || process.argv[1]
  //setup state
  this.counters = {}
  this.requests = 0
  this.running = false
  this.stopping = false
  //setup default options
  this.options = new ObjectManage({
    enhanced: false,
    count: null,
    maxConnections: null,
    stopTimeout: null,
    recycleTimeout: null,
    execArgv: null,
    silent: null,
    args: null
  })
  this.options.$load(options)
  //when we dont have enhanced mode, we need timeouts on stop
  if(!this.options.enhanced){
    if(!this.options.stopTimeout) this.options.stopTimeout = 1000
  }
  //setup worker count based on options or system
  this.count = this.options.count || os.cpus().length
  //set our module
  this.module = module
  //grab our cluster instance
  this.cluster = require('cluster')
  //allow customizing the scheduling policy
  this.cluster.schedulingPolicy =
    this.options.schedulingPolicy || this.cluster.SCHED_RR
  //setup master options
  this.cluster.setupMaster({
    execArgv: this.options.execArgv || [],
    exec: this.module,
    args: this.options.args || process.argv.slice(2),
    silent: this.options.silent || false
  })
  //setup an online listener that will bootstrap new workers
  this.cluster.on('online',this.setupWorker.bind(this))
  //setup an exit handler to respawn workers
  this.cluster.on('exit',this.respawn.bind(this))
}
Cluster.prototype = Object.create(EventEmitter.prototype)


/**
 * Execute given callback on each worker
 * @param {function} cb
 */
Cluster.prototype.each = function(cb){
  for(var i in this.cluster.workers){
    if(!this.cluster.workers.hasOwnProperty(i)) continue
    cb(this.cluster.workers[i])
  }
}


/**
 * Send a message to workers
 * @param {*} message
 */
Cluster.prototype.send = function(message){
  debug('sending message to workers',message)
  this.each(function(worker){
    worker.send(message)
  })
}


/**
 * Fork a new worker with internal options
 * @return {object}
 */
Cluster.prototype.fork = function(){
  debug('forking new worker')
  return this.cluster.fork()
}


/**
 * Bootstrap a worker with connection counting and recycling
 * @param {object} worker
 */
Cluster.prototype.setupWorker = function(worker){
  var that = this
  //setup connection counter
  that.counters[worker.id] = 0
  //in enhanced mode we wait for the worker to tell us its online
  if(that.options.enhanced){
    worker.on('message',function(msg){
      if('started' !== msg) return
      that.emit('online',worker)
    })
  } else {
    that.emit('online',worker)
  }
  //add a listener to sniff messages to count requests
  worker.on('message',function(msg){
    //make sure this is a handoff
    if(!msg || 'request' !== msg) return
    //track overall requests served
    that.requests++
    //increment the per worker counter
    that.counters[worker.id]++
    //debug('request counts updated',that.requests,that.counters[worker.id])
    //check if the worker is over the connection threshold, issue a shutdown
    if(
      that.options.maxConnections &&
      that.counters[worker.id] > that.options.maxConnections
    ){
      debug(
        'Worker ' + worker.id +
          ' has reached its connection limit, recycling',
        that.counters[worker.id])
      //spawn a new worker now
      that.fork()
      //tell the old worker to shutdown gracefully
      that.emit('recycle',worker,that.counters[worker.id])
      //force suicide to true, prevent respawns
      worker.suicide = true
      //in enhanced mode tell the worker to stop
      if(that.options.enhanced) worker.send('stop')
      //set a timeout to kill the worker so we dont bleed workers
      setTimeout(function(){
        worker.kill('SIGKILL')
      },that.options.recycleTimeout || 5000)
    }
  })
}


/**
 * Start workers
 * @param {function} done
 */
Cluster.prototype.start = function(done){
  var that = this
  var online = 0
  //handler initial workers coming online
  var workerStart = function(worker){
    debug('Worker ' + worker.id + ' online')
    //in enhanced mode we wait for the worker to confirm its started
    if(that.options.enhanced){
      worker.on('message',function(msg){
        if('started' !== msg) return
        online++
        if(online >= that.count && !that.running){
          deferred.resolve()
        }
      })
    }
    //otherwise just go by when the process comes up (which is lame)
    else {
      online++
      if(online >= that.count && !that.running){
        deferred.resolve()
      }
    }
  }
  //setup the promise to return
  var deferred = Q.defer()
  deferred.promise.then(
    function(){
      debug('Cluster started')
      that.cluster.removeListener('online',workerStart)
      that.running = true
      that.emit('started')
      done()
    },
    function(err){
      done(err)
    }
  )
  debug('Starting ' + that.count + ' workers')
  //spawn workers
  for(var i=1; i <= that.count; i++) that.fork()
  //wait for workers to come online
  that.cluster.on('online',workerStart)
}


/**
 * Respawn failed workers
 * @param {object} worker
 * @param {number} code
 * @param {string} signal
 */
Cluster.prototype.respawn = function(worker,code,signal){
  var that = this
  debug('Worker ' + worker.id + ' exited',code,signal)
  //remove the counter
  delete that.counters[worker.id]
  that.emit('exit',worker,code,signal)
  if(false === worker.suicide && !that.stopping){
    debug('Worker ' + worker.id + ' died (' + (signal || code) + ') restarting')
    that.cluster.once('online',function(worker){
      debug('Worker ' + worker.id + ' is now online')
      that.emit('respawn',worker,code,signal)
    })
    //start the new worker
    that.fork()
  }
}


/**
 * Stop workers
 * @param{function} done
 * @return {*}
 */
Cluster.prototype.stop = function(done){
  var that = this
  if(!that.running) return done()
  var interval
  var online = that.count
  that.stopping = true
  that.emit('stopping')
  debug('Stopping all workers')
  //setup the promise to return
  var deferred = Q.defer()
  deferred.promise.then(
    function(){
      if(interval) clearInterval(interval)
      that.emit('stopped')
      that.stopping = false
      that.running = false
      done()
    },
    function(err){
      done(err)
    }
  )
  //tell all the workers to stop
  if(that.options.enhanced) that.send('stop')
  //wait for the workers to all die
  var wait = function(){
    if(!that.cluster.workers) deferred.resolve()
    online = Object.keys(that.cluster.workers).length
    if(online > 0)
      debug('Waiting on ' + online + ' workers to exit')
    if(0 === online){
      debug('Cluster has stopped')
      deferred.resolve()
    }
  }
  //setup interval to watch workers
  if(that.options.enhanced) interval = setInterval(wait,1000)
  //if defined setup a backup timeout to kill the cluster anyway
  if(that.options.stopTimeout){
    setTimeout(function(){
      debug('Stop timeout reached, killing system')
      if(interval) clearInterval(interval)
      that.kill('SIGKILL')
      deferred.resolve()
    },that.options.stopTimeout)
  }
}


/**
 * Kill workers if they arent already dead
 * @param {string} signal
 */
Cluster.prototype.kill = function(signal){
  var that = this
  that.each(function(worker){
    debug(that.module,'sending worker pid ' + worker.process.pid + ' kill')
    worker.kill(signal || 'SIGTERM')
  })
}


/**
 * Restart cluster
 * @param {function} done
 */
Cluster.prototype.restart = function(done){
  var that = this
  that.stop(function(err){
    if(err) return done(err)
    that.start(function(err){
      if(err) return done(err)
      done()
    })
  })
}


/**
 * Export workers class
 * @param {string} file
 * @param {object} options
 * @return {cluster}
 */
module.exports = function(file,options){
  if(instance) return instance
  instance = new Cluster(util.resolveFile(file,2),options)
  return instance
}


/**
 * Export raw Cluster class
 * @type {cluster}
 */
module.exports.Cluster = Cluster


/**
 * Setup a worker to communicate with master
 * @param {http} server
 */
module.exports.setup = function(server){
  process.on('message',function(msg){
    if('stop' !== msg) return
    if(!server || !server._handle){
      process.exit(0)
      return
    }
    server.close(function(err){
      if(err) console.error('Failed to stop server: ' + err)
      process.exit(err ? 1 :0)
    })
  })
  server.on('listening',function(){
    process.send('started')
  })
  server.on('request',function(){
    process.send('request')
  })
}
