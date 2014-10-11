'use strict';
var expect = require('chai').expect
var request = require('request')

var cluster = require('../helpers/Cluster')


describe.only('helpers/Cluster',function(){
  this.timeout(10000)
  describe('lifecycle',function(){
    var inst
    beforeEach(function(done){
      inst = cluster('./assets/worker',{
        count: 1,
        stopTimeout: 100,
        respawn: false
      })
      done()
    })
    afterEach(function(done){
      if(true === inst.running){
        inst.stop(function(err){
          done(err)
        })
      } else done()
    })
    it('should start/stop',function(done){
      inst.start(function(err){
        if(err) return done(err)
        inst.stop(function(err){
          done(err)
        })
      })
    })
    it.only('should restart',function(done){
      inst.start(function(err){
        if(err) return done(err)
        inst.restart(function(err){
          done(err)
        })
      })
    })
    it('should respawn',function(done){
      inst.options.respawn = true
      inst.start(function(err){
        if(err) return done(err)
        inst.on('respawn',function(worker){
          expect(worker).to.be.an('object')
          inst.options.respawn = false
          done()
        })
        //issue a kill so it will respawn
        inst.each(function(worker){
          worker.process.kill()
        })
      })
    })
    it('should allow execution of a function on each worker',function(done){
      inst.start(function(err){
        if(err) return done(err)
        inst.each(function(worker){
          expect(worker).to.be.an('object')
          done()
        })
      })
    })
    it('should send messages to the children',function(done){
      inst.start(function(err){
        if(err) return done(err)
        inst.send('foo')
        done()
      })
    })
    describe('enhanced mode',function(){
      beforeEach(function(){
        inst.options.$load({
          enhanced: true,
          maxConnections: 10,
          stopTimeout: null,
          recycleTimeout: null
        })
      })
      it('should bubble complex errors properly',function(done){
        inst.options.env = {ERROR: 'true'}
        inst.start(function(err){
          expect(err).to.equal('[Error: foo]')
          inst.options.env = {}
          done()
        })
      })
      it('should startup and shutdown gracefully',function(done){
        inst.start(function(err){
          if(err) return done(err)
          inst.stop(function(err){
            if(err) return done(err)
            done()
          })
        })
      })
      it('should recycle worker after request ceiling',function(done){
        var makeRequest = function(){
          request('http://localhost:3333',function(err,res,body){
            if(err) return done(err)
            expect(body).to.equal('foo')
          })
        }
        inst.on('recycle',function(worker,connections){
          expect(worker).to.be.an('object')
          expect(connections).to.be.a('number')
          inst.once('online',function(worker){
            expect(worker).to.be.an('object')
            done()
          })
        })
        inst.start(function(err){
          if(err) return done(err)
          for(var i = 0; i<11; i++) makeRequest()
        })
      })

    })
  })
})
