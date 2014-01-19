/**
 * Module dependencies.
 */

var Route = require('./route')
  , utils = require('../utils')
  , methods = require('methods')
  , debug = require('debug')('express:router')
  , parse = require('connect').utils.parseUrl;

/**
 * Expose `Router` constructor.
 */

exports = module.exports = Router;

/**
 * Initialize a new `Router` with the given `options`.
 *
 * @param {Object} options
 * @api private
 */

function Router(options) {
  options = options || {};
  var self = this;

  self.params = {};
  self._params = [];
  self.caseSensitive = options.caseSensitive;
  self.strict = options.strict;
  self._routes = [];

  self.middleware = function router(req, res, next){
    self._dispatch(req, res, next);
  };
}

/**
 * Register a param callback `fn` for the given `name`.
 *
 * @param {String|Function} name
 * @param {Function} fn
 * @return {Router} for chaining
 * @api public
 */

Router.prototype.param = function(name, fn){
  // param logic
  if ('function' == typeof name) {
    this._params.push(name);
    return;
  }

  // apply param functions
  var params = this._params
    , len = params.length
    , ret;

  for (var i = 0; i < len; ++i) {
    if (ret = params[i](name, fn)) {
      fn = ret;
    }
  }

  // ensure we end up with a
  // middleware function
  if ('function' != typeof fn) {
    throw new Error('invalid param() call for ' + name + ', got ' + fn);
  }

  (this.params[name] = this.params[name] || []).push(fn);
  return this;
};

/**
 * Route dispatcher aka the route "middleware".
 *
 * @param {IncomingMessage} req
 * @param {ServerResponse} res
 * @param {Function} next
 * @api private
 */

Router.prototype._dispatch = function(req, res, next){
  var params = this.params
    , self = this;

  debug('dispatching %s %s (%s)', req.method, req.url, req.originalUrl);

  var method = req.method.toLowerCase();
  var url = parse(req);
  var path = url.pathname;

  var idx = 0;
  var routes = self._routes;
  var options = [];

  (function next_route(err) {

    // a route handler may change the url
    // in which case we need to now match on the new url
    // this is kinda messed up cause they could change it to something we
    // have already seen
    var url = parse(req);
    var path = url.pathname;

    if (err === 'route') {
      return next_route();
    }
    else if (err) {
      return next(err);
    }
    else if (idx >= routes.length) {
      if (method === 'options' && options.length) {
        var body = options.join(',');
        return res.set('Allow', body).send(body);
      }

      return next();
    }

    var route = routes[idx++];
    if (!route.match(path)) {
      return next_route();
    }

    if (method === 'options' && !route.methods['options']) {
      options.push.apply(options, route._options());
      return next_route();
    }

    // captured parameters from the route, keys and values
    req.params = route.params;
    var keys = route.keys;

    var i = 0;
    var paramIndex = 0;
    var key;
    var paramVal;
    var paramCallbacks;

    // process params in order
    // param callbacks can be async
    function param(err) {
      if (err) {
        return next_route(err);
      }

      if (i >= keys.length ) {
        return route.dispatch(req, res, next_route);
      }

      paramIndex = 0;
      key = keys[i++];
      paramVal = key && req.params[key.name];
      paramCallbacks = key && params[key.name];

      try {
        if (paramCallbacks && undefined !== paramVal) {
          return paramCallback();
        } else if (key) {
          return param();
        }
      } catch (err) {
        next_route(err);
      }

      route.dispatch(req, res, next_route);
    };

    // single param callbacks
    function paramCallback(err) {
      var fn = paramCallbacks[paramIndex++];
      if (err || !fn) return param(err);
      fn(req, res, paramCallback, paramVal, key.name);
    }

    param();
  })();
};

/**
 * Route `method`, `path`, and one or more callbacks.
 *
 * @param {String} method
 * @param {String} path
 * @param {Function} callback...
 * @return {Router} for chaining
 * @api private
 */

Router.prototype.route = function(path){
  var route = new Route(path, {
    sensitive: this.caseSensitive,
    strict: this.strict
  });

  this._routes.push(route);
  return route;
};

// for a given path, run for all methods
Router.prototype.all = function(path, fn) {
  var route = this.route(path);
  methods.forEach(function(method){
    route[method](fn);
  });
};

methods.forEach(function(method){
  Router.prototype[method] = function(path, fn){
    var self = this;
    self.route(path)[method](fn);
    return self;
  };
});
