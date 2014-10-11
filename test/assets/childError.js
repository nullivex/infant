'use strict';
var child = require('../../helpers/Child').child
var error = false

process.on('message',function(msg){
  if('ping' === msg) process.send('pong')
  if('error' === msg) error = true
})

child(
  'infant:test:child',
  //startup
  function(done){
    done(new Error('bar'))
  },
  //shutdown
  function(done){
    if(error) done('failed')
    else done()
  }
)
