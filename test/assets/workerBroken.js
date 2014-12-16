'use strict';
var http = require('http')

var setup = require('../../helpers/Cluster').setup

var server = {}

if(require.main === module){
  setup(
    server,
    'worker',
    function(done){
      server.listen(3333,function(err){
        if(process.env.ERROR) done(new Error('foo'))
        else done(err)
      })
    },
    function(done){
      server.close()
      done()
    }
  )
}

