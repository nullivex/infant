'use strict';
var http = require('http')

var setup = require('../../helpers/Cluster').setup

var server = http.createServer(function(req,res){
  res.end('foo')
})

if(require.main === module){
  setup(
    server,
    'worker',
    function(done){
      server.listen(3333,function(err){
        done(err)
      })
    },
    function(done){
      server.close()
      done()
    }
  )
}

