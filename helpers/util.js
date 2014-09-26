'use strict';
var callsite = require('callsite')
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
  else if(!file.match(/^\//)){
    //resolve the dir of the caller
    file = path.resolve(
      [path.dirname(callsite()[level || 2].getFileName()),file].join('/')
    )
  }
  return file
}
