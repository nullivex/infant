'use strict';
var callsite = require('callsite')
var debug = require('debug')('infant')
var path = require('path')


/**
 * Resolve file from callers relative path
 * @param {string} file
 * @param {number} level number of levels the caller is above
 * @return {*}
 */
exports.resolveFile = function(file,level){
  //resolve file
  if(!file) file = process.argv[1]
  else if(!file.match(/^\//) && !file.match(/^[A-Z]:/)){
    //resolve the dir of the caller
    file = path.resolve(
      [path.dirname(callsite()[level || 2].getFileName()),file].join('/')
    )
  }
  return file
}


/**
 * Setup a debugger prefixed with the pid
 * @param {String|number} prefix
 * @param {debug} inst Debugger instance to call
 * @return {function}
 */
exports.prefixDebug = function(prefix,inst){
  inst = inst || debug
  return function(){
    var args = [prefix]
    for(var i in arguments){
      if(!arguments.hasOwnProperty(i)) continue
      args.push(arguments[i])
    }
    inst.apply(null,args)
  }
}


/**
 * Prepare a worker, currently implements a workaround to deal with an
 * assertion error that says: "Resource leak detected"
 * This code is taken from the following issue:
 * https://github.com/nodejs/node-v0.x-archive/issues/9409#issuecomment-84038111
 * @param {object} worker
 * @return {object} worker
 */
exports.prepareWorker = function(worker){
  var listeners = worker.process.listeners('exit')[0]
  var exit = listeners[Object.keys(listeners)[0]]

  listeners = worker.process.listeners('disconnect')[0]
  var disconnect = listeners[Object.keys(listeners)[0]]

  if('function' === typeof exit){
    worker.process.removeListener('exit',exit)
  }
  worker.process.once('exit', function(exitCode,signalCode){
    if(worker.state !== 'disconnected' && 'function' === typeof disconnect){
      disconnect()
    }
    if('function' === typeof exit){
      exit(exitCode,signalCode)
    }
  })
  return worker
}
