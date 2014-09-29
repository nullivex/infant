'use strict';
var child = require('../../helpers/Child').childOnce

child('infant:test:childOnce',function(){
  //do nothing and be killed by a timeout
  setInterval(function(){return true},10000)
})
