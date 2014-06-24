var global = (typeof window !== 'undefined') ? window : {},
    Ember = global.Ember;

/**
  __The session provides access to the current authentication state as well as
  any data the authenticator resolved with__ (see
  [`Authenticators.Base#authenticate`](#SimpleAuth-Authenticators-Base-authenticate)).
  It is created when Ember Simple Auth is set up and __injected into all
  controllers and routes so that these parts of the application can always
  access the current authentication state and other data__, depending on the
  authenticator in use and whether the session is actually authenticated (see
  [`Authenticators.Base`](#SimpleAuth-Authenticators-Base)).

  The session also provides methods to authenticate and to invalidate itself
  (see
  [`Session#authenticate`](#SimpleAuth-Session-authenticate),
  [`Session#invaldiate`](#SimpleAuth-Session-invaldiate)).
  These methods are usually invoked through actions from routes or controllers.
  To authenticate the session manually, simple call the
  [`Session#authenticate`](#SimpleAuth-Session-authenticate)
  method with the authenticator factory to use as well as any options the
  authenticator needs to authenticate the session:

  ```javascript
  this.get('session').authenticate('authenticatorFactory', { some: 'option' }).then(function() {
    // authentication was successful
  }, function() {
    // authentication failed
  });
  ```

  The session also observes the store and - if it is authenticated - the
  authenticator for changes (see
  [`Authenticators.Base`](#SimpleAuth-Authenticators-Base)
  end [`Stores.Base`](#SimpleAuth-Stores-Base)).

  @class Session
  @namespace SimpleAuth
  @module simple-auth/session
  @extends Ember.ObjectProxy
  @uses Ember.Evented
*/
export default Ember.ObjectProxy.extend(Ember.Evented, {
  /**
    Triggered __whenever the session is successfully authenticated__. When the
    application uses the
    [`ApplicationRouteMixin` mixin](#SimpleAuth-ApplicationRouteMixin),
    [`ApplicationRouteMixin.actions#sessionAuthenticationSucceeded`](#SimpleAuth-ApplicationRouteMixin-sessionAuthenticationSucceeded)
    will be invoked whenever this event is triggered.

    @event sessionAuthenticationSucceeded
  */
  /**
    Triggered __whenever an attempt to authenticate the session fails__. When
    the application uses the
    [`ApplicationRouteMixin` mixin](#SimpleAuth-ApplicationRouteMixin),
    [`ApplicationRouteMixin.actions#sessionAuthenticationFailed`](#SimpleAuth-ApplicationRouteMixin-sessionAuthenticationFailed)
    will be invoked whenever this event is triggered.

    @event sessionAuthenticationFailed
    @param {Object} error The error object; this depends on the authenticator in use, see [SimpleAuth.Authenticators.Base#authenticate](#SimpleAuth-Authenticators-Base-authenticate)
  */
  /**
    Triggered __whenever the session is successfully invalidated__. When the
    application uses the
    [`ApplicationRouteMixin` mixin](#SimpleAuth-ApplicationRouteMixin),
    [`ApplicationRouteMixin.actions#sessionInvalidationSucceeded`](#SimpleAuth-ApplicationRouteMixin-sessionInvalidationSucceeded)
    will be invoked whenever this event is triggered.

    @event sessionInvalidationSucceeded
  */
  /**
    Triggered __whenever an attempt to invalidate the session fails__. When the
    application uses the
    [`ApplicationRouteMixin` mixin](#SimpleAuth-ApplicationRouteMixin),
    [`ApplicationRouteMixin.actions#sessionInvalidationFailed`](#SimpleAuth-ApplicationRouteMixin-sessionInvalidationFailed)
    will be invoked whenever this event is triggered.

    @event sessionInvalidationFailed
    @param {Object} error The error object; this depends on the authenticator in use, see [SimpleAuth.Authenticators.Base#invalidate](#SimpleAuth-Authenticators-Base-invalidate)
  */
  /**
    Triggered __whenever the server rejects the authorization information
    passed with a request and responds with status 401__. When the application
    uses the
    [`ApplicationRouteMixin` mixin](#SimpleAuth-ApplicationRouteMixin),
    [`ApplicationRouteMixin.actions#authorizationFailed`](#SimpleAuth-ApplicationRouteMixin-authorizationFailed)
    will be invoked whenever this event is triggered.

    @event authorizationFailed
  */

  /**
    The authenticator factory used to authenticate the session. This is only
    set when the session is currently authenticated.

    @property authenticatorFactory
    @type String
    @readOnly
    @default null
  */
  authenticatorFactory: null,
  /**
    The store used to persist session properties.

    @property store
    @type SimpleAuth.Stores.Base
    @readOnly
    @default null
  */
  store: null,
  /**
    Returns whether the session is currently authenticated.

    @property isAuthenticated
    @type Boolean
    @readOnly
    @default false
  */
  isAuthenticated: false,
  /**
    @property attemptedTransition
    @private
  */
  attemptedTransition: null,
  /**
    @property content
    @private
  */
  content: {},

  /**
    @method init
    @private
  */
  init: function() {
    this.bindToStoreEvents();
  },

  /**
    Authenticates the session with an `authenticator` and appropriate
    `options`. __This delegates the actual authentication work to the
    `authenticator`__ and handles the returned promise accordingly (see
    [`Authenticators.Base#authenticate`](#SimpleAuth-Authenticators-Base-authenticate)).
    All data the authenticator resolves with will be saved in the session.

    __This method returns a promise itself. A resolving promise indicates that
    the session was successfully authenticated__ while a rejecting promise
    indicates that authentication failed and the session remains
    unauthenticated.

    @method authenticate
    @param {String} authenticatorFactory The authenticator factory to use as it is registered with Ember's container, see [Ember's API docs](http://emberjs.com/api/classes/Ember.Application.html#method_register)
    @param {Object} options The options to pass to the authenticator; depending on the type of authenticator these might be a set of credentials, a Facebook OAuth Token, etc.
    @return {Ember.RSVP.Promise} A promise that resolves when the session was authenticated successfully
  */
  authenticate: function(authenticatorFactory, options) {
    Ember.assert('Session#authenticate requires the authenticator factory to be specified, was ' + authenticatorFactory, !Ember.isEmpty(authenticatorFactory));
    var _this = this;
    return new Ember.RSVP.Promise(function(resolve, reject) {
      _this.container.lookup(authenticatorFactory).authenticate(options).then(function(content) {
        _this.setup(authenticatorFactory, content, true);
        resolve();
      }, function(error) {
        _this.clear();
        _this.trigger('sessionAuthenticationFailed', error);
        reject(error);
      });
    });
  },

  /**
    Invalidates the session with the authenticator it is currently
    authenticated with (see
    [`Session#authenticatorFactory`](#SimpleAuth-Session-authenticatorFactory)).
    __This invokes the authenticator's `invalidate` method and handles the
    returned promise accordingly__ (see
    [`Authenticators.Base#invalidate`](#SimpleAuth-Authenticators-Base-invalidate)).

    __This method returns a promise itself. A resolving promise indicates that
    the session was successfully invalidated__ while a rejecting promise
    indicates that the promise returned by the `authenticator` rejected and
    thus invalidation was cancelled. In that case the session remains
    authenticated. Once the session is successfully invalidated it clears all
    of its data.

    @method invalidate
    @return {Ember.RSVP.Promise} A promise that resolves when the session was invalidated successfully
  */
  invalidate: function() {
    var _this = this;
    return new Ember.RSVP.Promise(function(resolve, reject) {
      var authenticator = _this.container.lookup(_this.authenticatorFactory);
      authenticator.invalidate(_this.content).then(function() {
        authenticator.off('sessionDataUpdated');
        _this.clear(true);
        resolve();
      }, function(error) {
        _this.trigger('sessionInvalidationFailed', error);
        reject(error);
      });
    });
  },

  /**
    @method restore
    @private
  */
  restore: function() {
    var _this = this;
    return new Ember.RSVP.Promise(function(resolve, reject) {
      var restoredContent      = _this.store.restore();
      var authenticatorFactory = restoredContent.authenticatorFactory;
      if (!!authenticatorFactory) {
        delete restoredContent.authenticatorFactory;
        _this.container.lookup(authenticatorFactory).restore(restoredContent).then(function(content) {
          _this.setup(authenticatorFactory, content);
          resolve();
        }, function() {
          _this.store.clear();
          reject();
        });
      } else {
        _this.store.clear();
        reject();
      }
    });
  },

  /**
    @method setup
    @private
  */
  setup: function(authenticatorFactory, content, trigger) {
    trigger = !!trigger && !this.get('isAuthenticated');
    this.beginPropertyChanges();
    this.setProperties({
      isAuthenticated:      true,
      authenticatorFactory: authenticatorFactory,
      content:              content
    });
    this.bindToAuthenticatorEvents();
    var data = Ember.$.extend({ authenticatorFactory: authenticatorFactory }, this.content);
    this.store.replace(data);
    this.endPropertyChanges();
    if (trigger) {
      this.trigger('sessionAuthenticationSucceeded');
    }
  },

  /**
    @method clear
    @private
  */
  clear: function(trigger) {
    trigger = !!trigger && this.get('isAuthenticated');
    this.beginPropertyChanges();
    this.setProperties({
      isAuthenticated:      false,
      authenticatorFactory: null,
      content:              {}
    });
    this.store.clear();
    this.endPropertyChanges();
    if (trigger) {
      this.trigger('sessionInvalidationSucceeded');
    }
  },

  /**
    @method bindToAuthenticatorEvents
    @private
  */
  bindToAuthenticatorEvents: function() {
    var _this = this;
    var authenticator = this.container.lookup(this.authenticatorFactory);
    authenticator.off('sessionDataUpdated');
    authenticator.off('sessionDataInvalidated');
    authenticator.on('sessionDataUpdated', function(content) {
      _this.setup(_this.authenticatorFactory, content);
    });
    authenticator.on('sessionDataInvalidated', function(content) {
      _this.clear(true);
    });
  },

  /**
    @method bindToStoreEvents
    @private
  */
  bindToStoreEvents: function() {
    var _this = this;
    this.store.on('sessionDataUpdated', function(content) {
      var authenticatorFactory = content.authenticatorFactory;
      if (!!authenticatorFactory) {
        delete content.authenticatorFactory;
        _this.container.lookup(authenticatorFactory).restore(content).then(function(content) {
          _this.setup(authenticatorFactory, content, true);
        }, function() {
          _this.clear(true);
        });
      } else {
        _this.clear(true);
      }
    });
  }
});