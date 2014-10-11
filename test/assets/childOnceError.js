'use strict';
var child = require('../../helpers/Child').childOnce

child('infant:test:childOnce',function(done){
  done(new Error('baz'))
})
