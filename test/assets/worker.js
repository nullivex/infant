'use strict';
var http = require('http')

var setup = require('../../helpers/Cluster').setup

var server = http.createServer(function(req,res){
  res.end('foo')
})

//bootstrap to talk to master
setup(server)

//start listening
server.listen(3333,function(err){
  if(err) throw err
})


