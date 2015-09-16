'use strict';
var expect = require('chai').expect

var infantUtil = require('../helpers/util')


describe('helpers/util',function(){
  describe('resolveFile',function(){
    it('should resolve relative paths',function(done){
      var file = infantUtil.resolveFile('./config')
      expect(file).to.be.a('string')
      expect(file).to.not.equal('./config')
      done()
    })
    it('should not resolve absolute UNIX paths',function(done){
      var file = infantUtil.resolveFile('/var/config')
      expect(file).to.be.a('string')
      expect(file).to.equal('/var/config')
      done()
    })
    it('should not resolve absolute Windows paths',function(done){
      var file = infantUtil.resolveFile('C:/foo')
      expect(file).to.be.a('string')
      expect(file).to.equal('C:/foo')
      done()
    })
  })
})
