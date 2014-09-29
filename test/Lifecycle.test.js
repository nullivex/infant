'use strict';
var expect = require('chai').expect

var Lifecycle = require('../helpers/Lifecycle')


describe('helpers/Lifecycle',function(){
  var inst
  beforeEach(function(done){
    inst = new Lifecycle()
    done()
  })
  afterEach(function(done){
    inst = null
    done()
  })
  it('should allow adding of sequences',function(done){
    inst.add('test')
    expect(inst.items[0].title).to.equal('test')
    done()
  })
  it('should allow adding of sequences without title',function(done){
    inst.add(function(next){
      expect(next).to.be.a('function')
      next()
    })
    inst.start(done)
  })
  it('should allow removing of sequences',function(done){
    inst.add('test')
    var item = inst.remove('test')
    expect(item.title).to.equal('test')
    expect(inst.items[0]).to.equal(undefined)
    done()
  })
  it('should start in order',function(done){
    inst.add('test1')
    inst.add('test2')
    inst.once('start',function(item){
      expect(item.title).to.equal('test1')
      inst.once('start',function(item){
        expect(item.title).to.equal('test2')
      })
    })
    inst.start(done)
  })
  it('should stop in order',function(done){
    inst.add('test1')
    inst.add('test2')
    inst.once('stop',function(item){
      expect(item.title).to.equal('test2')
      inst.once('stop',function(item){
        expect(item.title).to.equal('test1')
      })
    })
    inst.stop(done)
  })
  it('should call callbacks during start',function(done){
    inst.add('test1',function(next){
      expect(next).to.be.a('function')
      next()
    })
    inst.start(done)
  })
  it('should call callbacks during stop',function(done){
    inst.add('test2',function(next){
      expect(next).to.be.a('function')
      next()
    })
    inst.stop(done)
  })
  it('should bubble errors on start',function(done){
    inst.add('test1',function(next){
      next('foo')
    })
    inst.start(function(err){
      expect(err).to.equal('foo')
      done()
    })
  })
  it('should bubble errors on stop',function(done){
    inst.add('test1',null,function(next){
      next('foo')
    })
    inst.stop(function(err){
      expect(err).to.equal('foo')
      done()
    })
  })
  it('should emit a start event',function(done){
    inst.add('test1',function(next){next()})
    inst.once('start',function(item){
      expect(item.title).to.equal('test1')
      done()
    })
    inst.start(function(err){if(err) done(err)})
  })
  it('should emit a stop event',function(done){
    inst.add('test1',null,function(next){next()})
    inst.once('stop',function(item){
      expect(item.title).to.equal('test1')
      done()
    })
    inst.stop(function(err){if(err) done(err)})
  })
  it('should emit an online event',function(done){
    inst.add('test1')
    inst.once('online',function(){
      done()
    })
    inst.start(function(err){if(err) done(err)})
  })
  it('should emit an offline event',function(done){
    inst.add('test1')
    inst.once('offline',function(){
      done()
    })
    inst.stop(function(err){if(err) done(err)})
  })
  it('should emit an add event',function(done){
    inst.once('add',function(item){
      expect(item.title).to.equal('test1')
      done()
    })
    inst.add('test1')
  })
  it('should emit a remove event',function(done){
    inst.once('remove',function(item){
      expect(item.title).to.equal('test1')
      done()
    })
    inst.add('test1')
    inst.remove('test1')
  })
  it('should not start items without start functions',function(done){
    inst.add('dont start',null,function(next){next()})
    inst.once('start',function(){
      done('should not have started')
    })
    inst.start(done)
  })
  it('should not stop items without stop functions',function(done){
    inst.add('dont stop',function(next){next()})
    inst.once('stop',function(){
      done('should not have stopped')
    })
    inst.stop(done)
  })
})
