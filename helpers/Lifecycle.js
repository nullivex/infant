'use strict';
var async = require('async')



/**
 * Lifecycle helper
 *   Useful for registering complex startup/shutdown sequences in
 *   userspace, for ease of tracking in userspace
 *   lets be honest, it just runs some arrays through eachSeries :)
 * @constructor
 */
var Lifecycle = function(){
  this._start = []
  this._stop = []
}


/**
 * Add a new sequence
 * @param {function} start
 * @param {function} stop
 */
Lifecycle.prototype.add = function(start,stop){
  if(start && 'function' === typeof start) this._start.push(start)
  if(stop && 'function' === typeof stop) this._stop.unshift(stop)
}


/**
 * Remove a sequence from the stack
 * @param {function} start
 * @param {function} stop
 */
Lifecycle.prototype.remove = function(start,stop){
  if(start && 'function' === typeof start)
    this._start.splice(this._start.indexOf(start),1)
  if(stop && 'function' === typeof stop)
    this._stop.splice(this._start.indexOf(stop),1)
}


/**
 * Start the system
 * @param {function} done
 */
Lifecycle.prototype.start = function(done){
  async.eachSeries(
    this._start,
    function(item,next){item(next)},
    done
  )
}


/**
 * Stop the system
 * @param {function} done
 */
Lifecycle.prototype.stop = function(done){
  async.eachSeries(
    this._stop,
    function(item,next){item(next)},
    done
  )
}


/**
 * Export the helper
 * @type {Lifecycle}
 */
module.exports = Lifecycle
