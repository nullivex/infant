'use strict';
var debug = require('debug')('infant:Cluster')
var EventEmitter = require('events').EventEmitter
var net = require('net')
var ObjectManage = require('object-manage')
var os = require('os')
var Q = require('q')
var util = require('util')

var infantUtil = require('./util')

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
    respawn: true,
    respawnDelay: 1000,
    count: null,
    maxConnections: null,
    stopTimeout: null,
    recycleTimeout: null,
    execArgv: null,
    silent: null,
    args: null,
    env: {}
  })
  this.options.$load(options)
  //when we dont have enhanced mode, we need timeouts on stop
  if(!this.options.enhanced){
    if(!this.options.stopTimeout) this.options.stopTimeout = 5000
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
    try {
      var majorVersion = +process.version.replace('v','').substr(0,1)
      if(0 === majorVersion){
        worker.send('' + message)
      } else {
        worker.send('' + message,function(err){
          if(err) debug(worker.process.pid,'send error',err)
        })
      }
    } catch(e){
      debug(worker.process.pid,'send failed',e)
    }
  })
}


/**
 * Fork a new worker with internal options
 * @return {object}
 */
Cluster.prototype.fork = function(){
  debug('forking new worker with env',this.options.env)
  return infantUtil.prepareWorker(this.cluster.fork(this.options.env))
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
      if('started' === msg.status)
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
      that.counters[worker.id] >= that.options.maxConnections &&
      !worker.recycling
    ){
      worker.recycling = true
      debug(
        'Worker ' + worker.process.pid + ' has reached its connection limit ' +
        '(' + that.counters[worker.id] + '), recycling'
      )
      //spawn a new worker now
      var newWorker = that.fork()
      var startedListener = function(msg){
        if('object' !== typeof msg || 'started' !== msg.status) return
        newWorker.removeListener('message',startedListener)
        //need to wait until the new worker is online before killing the
        //old one
        //tell the old worker to shutdown gracefully
        that.emit('recycle',worker,that.counters[worker.id])
        //in enhanced mode tell the worker to stop
        if(that.options.enhanced){
          //set a timeout to kill the worker so we dont bleed workers
          var killed = false
          var disconnectTimeout = setTimeout(function(){
            debug('worker ' + worker.process.pid + ' recycle timeout ' +
            'exceeded... killed. recycle complete')
            killed = true
            worker.kill('SIGKILL')
          },that.options.recycleTimeout || 30000)
          worker.on('disconnect',function(){
            if(!killed){
              clearTimeout(disconnectTimeout)
              debug('worker ' + worker.process.pid + ' recycled successfully!')
              if('function' === typeof worker.kill){
                worker.kill('SIGKILL')
              } else {
                try {
                  worker.send('stop')
                } catch(e){
                  debug(worker.process.pid,'kill failed',e)
                }
              }
            }
            delete that.counters[worker.id]
          })
          worker.disconnect()
        } else {
          worker.kill('SIGKILL')
        }
      }
      newWorker.on('message',startedListener)
    }
  })
}


/**
 * Start workers
 * @param {function} done
 */
Cluster.prototype.start = function(done){
  var that = this
  that.running = false
  var online = 0
  //handler initial workers coming online
  var workerStart = function(worker){
    debug('Worker ' + worker.process.pid + ' online')
    //in enhanced mode we wait for the worker to confirm its started
    if(that.options.enhanced){
      worker.once('message',function(msg){
        debug('got message from ' + worker.process.pid,msg)
        if('started' === msg.status){
          debug('Worker ' + worker.process.pid + ' started')
          online++
          if(online >= that.count && !that.running){
            deferred.resolve()
          }
        } else {
          if('error' === msg.status)
            deferred.reject(msg.message)
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
  debug('Worker ' + worker.process.pid + ' exited',code,signal)
  //remove the counter
  delete that.counters[worker.id]
  that.emit('exit',worker,code,signal)
  var workerSuicideFlag = 'suicide'
  var majorVersion = process.version.replace('v','').substr(0,1)
  if(majorVersion >= 6) workerSuicideFlag = 'exitedAfterDisconnect'
  if(
    false === worker[workerSuicideFlag] &&
    !that.stopping &&
    that.running &&
    that.options.respawn
  ){
    debug('Worker ' + worker.process.pid +
    ' died (' + (signal || code) + ') and is respawn eligible, restarting')
    that.cluster.once('online',function(worker){
      debug('Worker ' + worker.process.pid + ' is now online')
      that.emit('respawn',worker,code,signal)
    })
    //start the new worker
    setTimeout(function(){
      that.fork()
    },that.respawnDelay)
  } else {
    debug('Worker ' + worker.process.pid +
    ' died (' + (signal || code) + ') and is not respawn eligible, exiting')
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
    done
  )
  //tell all the workers to stop
  if(that.options.enhanced) that.send('stop')
  //register a handler for graceful worker exit
  var workerStop = function(msg){
    //handle shutdown errors
    if(msg && 'error' === msg.status){
      deferred.reject(msg.message)
    }
  }
  that.each(function(worker){
    worker.on('message',workerStop)
  })
  //wait for the workers to all die
  var wait = function(){
    if(!that.cluster.workers) deferred.resolve()
    online = Object.keys(that.cluster.workers).length
    if(online > 0)
      debug('Waiting on ' + online + ' workers to exit')
    if(0 === online){
      //cleanup listeners
      that.each(function(worker){
        worker.removeAllListeners('message')
        worker.removeAllListeners('online')
        worker.removeAllListeners('exit')
      })
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
    debug(that.module,'sending worker ' + worker.process.pid +
      ' kill (' + signal + ')')
    if('function' === typeof worker.kill){
      worker.kill(signal || 'SIGTERM')
    } else {
      try {
        worker.send('stop')
      } catch(e){
        debug(worker.process.pid,'kill failed',e)
      }

    }
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
  instance = new Cluster(infantUtil.resolveFile(file,2),options)
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
 * @param {string} title
 * @param {function} start
 * @param {function} stop
 */
module.exports.setup = function(server,title,start,stop){
  if(!(server instanceof net.Server))
    throw new Error('Not a valid net server passed for cluster setup')
  var debug = infantUtil.prefixDebug(
    process.pid,
    require('debug')('infant:ClusterWorker')
  )
  var doStop = function(){
    stop(function(err){
      if(err){
        debug('stop failed',err)
        if(process.send) process.send({status: 'error', message: err})
        process.exit(1)
        return
      }
      debug('stop complete')
      process.exit()
    })
  }
  debug('setting process title',title)
  process.title = title
  //if we are running as a child, setup handlers
  if(process.send){
    process.on('SIGTERM',function(){
      debug('ignored SIGTERM')
    })
    process.on('SIGINT',function(){
      debug('ignored SIGINT')
    })
    process.on('SIGHUP',function(){
      debug('got SIGHUP, gracefully exiting')
      doStop()
    })
  } else {
    //for single process handling
    require('node-sigint')
    process.on('SIGTERM',function(){
      debug('got SIGTERM')
      doStop()
    })
    process.on('SIGINT',function(){
      debug('got SIGINT')
      doStop()
    })
  }
  process.on('message',function(msg){
    debug('got message',msg)
    if('stop' === msg){
      debug('got stop, shutting down')
      doStop()
    }
  })
  debug('executing start')
  start(function(err){
    if(err){
      err = util.inspect(err)
      debug('start failed',err)
      if(process.send)
        process.send({status: 'error', message: err})
      process.exit(1)
      return
    }
    debug('start finished')
    if(process.send) process.send({status: 'started'})
    server.on('request',function(){
      if(process.send && process.connected) process.send('request')
    })
  })
}
