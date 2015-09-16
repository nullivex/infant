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
