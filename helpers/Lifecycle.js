'use strict';
var async = require('async')
var EventEmitter = require('events').EventEmitter

var nullFunc = function(done){done()}



/**
 * Lifecycle helper
 *   Useful for registering complex startup/shutdown sequences in
 *   userspace, for ease of tracking in userspace
 *   lets be honest, it just runs some arrays through eachSeries :)
 * @constructor
 */
var Lifecycle = function(){
  EventEmitter.call(this)
  this.items = []
}
Lifecycle.prototype = Object.create(EventEmitter.prototype)


/**
 * Get the next index
 * @return {Number}
 */
Lifecycle.prototype.nextIndex = function(){
  return this.items.length
}


/**
 * Add a new sequence
 * @param {string} title
 * @param {function} start
 * @param {function} stop
 * @return {object} item
 */
Lifecycle.prototype.add = function(title,start,stop){
  if('function' === typeof title){
    start = title
    stop = start
    title = this.nextIndex()
  }
  var item = {
    index: this.nextIndex(),
    title: title,
    start: start || nullFunc,
    stop: stop || nullFunc
  }
  this.emit('add',item)
  this.items.push(item)
  return item
}


/**
 * Remove a sequence from the stack
 * @param {string} title
 * @return {object} item
 */
Lifecycle.prototype.remove = function(title){
  var that = this
  var item = null
  //remove the item
  that.items.forEach(function(v,i){
    if(title === v.title){
      item = that.items.splice(i,1)[0]
      that.emit('remove',item)
    }
  })
  return item
}


/**
 * Start the system
 * @param {function} done
 */
Lifecycle.prototype.start = function(done){
  var that = this
  //sort into start order
  that.items = that.items.sort(function(a,b){return a.index - b.index})
  //start items
  async.eachSeries(
    that.items,
    function(item,next){
      that.emit('start',item)
      item.start(next)
    },
    function(err){
      if(err) return done(err)
      that.emit('online')
      done()
    }
  )
}


/**
 * Stop the system
 * @param {function} done
 */
Lifecycle.prototype.stop = function(done){
  var that = this
  //sort into stop order
  that.items = that.items.sort(function(a,b){return b.index - a.index})
  //stop items
  async.eachSeries(
    that.items,
    function(item,next){
      that.emit('stop',item)
      item.stop(next)
    },
    function(err){
      if(err) return done(err)
      that.emit('offline')
      done()
    }
  )
}


/**
 * Export the helper
 * @type {Lifecycle}
 */
module.exports = Lifecycle
