'use strict';
var cluster = require('../../helpers/Cluster')

var inst = cluster('./worker',{
  count: 1,
  stopTimeout: 100,
  heartbeat: 100,
  enhanced: true,
  respawn: false
})

inst.start()

inst.on('orphan',function(worker){
  process.send({
    status: 'error',
    message: 'Worker has been orphaned',
    worker: worker
  })
})

setTimeout(function(){
  if(process.env.EXIT) inst.stopHeartbeat()
},200)
