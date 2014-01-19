
var express = require('../')
  , Router = express.Router
  , request = require('./support/http')
  , methods = require('methods')
  , assert = require('assert');

describe('Router', function(){
  var router, app;

  beforeEach(function(){
    router = new Router;
    app = express();
  })

  describe('.middleware', function(){
    it('should dispatch', function(done){
      router.route('/foo').get(function(req, res){
        res.send('foo');
      });

      app.use(router.middleware);

      request(app)
      .get('/foo')
      .expect('foo', done);
    })
  })

  describe('.multiple callbacks', function(){
    it('should throw if a callback is null', function(){
      assert.throws(function () {
        router.route('/foo').use(null);
      })
    })

    it('should throw if a callback is undefined', function(){
      assert.throws(function () {
        router.route('/foo').use(undefined);
      })
    })

    it('should throw if a callback is not a function', function(){
      assert.throws(function () {
        router.route('/foo').use('not a function');
      })
    })

    it('should not throw if all callbacks are functions', function(){
      router.route('/foo').use(function(){}).use(function(){});
    })
  })

  describe('.all', function() {
    it('should support using .all to capture all http verbs', function(done) {
      var router = new Router();

      var count = 0;
      router.all('/foo', function(){ count++; });

      var url = '/foo?bar=baz';

      methods.forEach(function testMethod(method) {
        router._dispatch({ url: url, method: method }, {}, function() {});
      });

      assert.equal(count, methods.length);
      done();
    })
  })
})
