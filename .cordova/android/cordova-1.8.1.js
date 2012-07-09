// commit 722ce5820b6fc3e371245927e00c7f9745eb041a

// File generated at :: Tue Jun 12 2012 11:04:57 GMT-0700 (PDT)

/*
 Licensed to the Apache Software Foundation (ASF) under one
 or more contributor license agreements.  See the NOTICE file
 distributed with this work for additional information
 regarding copyright ownership.  The ASF licenses this file
 to you under the Apache License, Version 2.0 (the
 "License"); you may not use this file except in compliance
 with the License.  You may obtain a copy of the License at
 
     http://www.apache.org/licenses/LICENSE-2.0
 
 Unless required by applicable law or agreed to in writing,
 software distributed under the License is distributed on an
 "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied.  See the License for the
 specific language governing permissions and limitations
 under the License.
*/

;(function() {

// file: lib/scripts/require.js
var require,
    define;

(function () {
    var modules = {};

    function build(module) {
        var factory = module.factory;
        module.exports = {};
        delete module.factory;
        factory(require, module.exports, module);
        return module.exports;
    }

    require = function (id) {
        if (!modules[id]) {
            throw "module " + id + " not found";
        }
        return modules[id].factory ? build(modules[id]) : modules[id].exports;
    };

    define = function (id, factory) {
        if (modules[id]) {
            throw "module " + id + " already defined";
        }

        modules[id] = {
            id: id,
            factory: factory
        };
    };

    define.remove = function (id) {
        delete modules[id];
    };

})();

//Export for use in node
if (typeof module === "object" && typeof require === "function") {
    module.exports.require = require;
    module.exports.define = define;
}
// file: lib/cordova.js
define("cordova", function(require, exports, module) {
var channel = require('cordova/channel');

/**
 * Listen for DOMContentLoaded and notify our channel subscribers.
 */
document.addEventListener('DOMContentLoaded', function() {
    channel.onDOMContentLoaded.fire();
}, false);
if (document.readyState == 'complete' || document.readyState == 'interactive') {
    channel.onDOMContentLoaded.fire();
}

/**
 * Intercept calls to addEventListener + removeEventListener and handle deviceready,
 * resume, and pause events.
 */
var m_document_addEventListener = document.addEventListener;
var m_document_removeEventListener = document.removeEventListener;
var m_window_addEventListener = window.addEventListener;
var m_window_removeEventListener = window.removeEventListener;

/**
 * Houses custom event handlers to intercept on document + window event listeners.
 */
var documentEventHandlers = {},
    windowEventHandlers = {};

document.addEventListener = function(evt, handler, capture) {
    var e = evt.toLowerCase();
    if (typeof documentEventHandlers[e] != 'undefined') {
        if (evt === 'deviceready') {
            documentEventHandlers[e].subscribeOnce(handler);
        } else {
            documentEventHandlers[e].subscribe(handler);
        }
    } else {
        m_document_addEventListener.call(document, evt, handler, capture);
    }
};

window.addEventListener = function(evt, handler, capture) {
    var e = evt.toLowerCase();
    if (typeof windowEventHandlers[e] != 'undefined') {
        windowEventHandlers[e].subscribe(handler);
    } else {
        m_window_addEventListener.call(window, evt, handler, capture);
    }
};

document.removeEventListener = function(evt, handler, capture) {
    var e = evt.toLowerCase();
    // If unsubcribing from an event that is handled by a plugin
    if (typeof documentEventHandlers[e] != "undefined") {
        documentEventHandlers[e].unsubscribe(handler);
    } else {
        m_document_removeEventListener.call(document, evt, handler, capture);
    }
};

window.removeEventListener = function(evt, handler, capture) {
    var e = evt.toLowerCase();
    // If unsubcribing from an event that is handled by a plugin
    if (typeof windowEventHandlers[e] != "undefined") {
        windowEventHandlers[e].unsubscribe(handler);
    } else {
        m_window_removeEventListener.call(window, evt, handler, capture);
    }
};

function createEvent(type, data) {
    var event = document.createEvent('Events');
    event.initEvent(type, false, false);
    if (data) {
        for (var i in data) {
            if (data.hasOwnProperty(i)) {
                event[i] = data[i];
            }
        }
    }
    return event;
}

if(typeof window.console === "undefined") {
    window.console = {
        log:function(){}
    };
}

var cordova = {
    define:define,
    require:require,
    /**
     * Methods to add/remove your own addEventListener hijacking on document + window.
     */
    addWindowEventHandler:function(event, opts) {
        return (windowEventHandlers[event] = channel.create(event, opts));
    },
    addDocumentEventHandler:function(event, opts) {
        return (documentEventHandlers[event] = channel.create(event, opts));
    },
    removeWindowEventHandler:function(event) {
        delete windowEventHandlers[event];
    },
    removeDocumentEventHandler:function(event) {
        delete documentEventHandlers[event];
    },
    /**
     * Retreive original event handlers that were replaced by Cordova
     *
     * @return object
     */
    getOriginalHandlers: function() {
        return {'document': {'addEventListener': m_document_addEventListener, 'removeEventListener': m_document_removeEventListener},
        'window': {'addEventListener': m_window_addEventListener, 'removeEventListener': m_window_removeEventListener}};
    },
    /**
     * Method to fire event from native code
     */
    fireDocumentEvent: function(type, data) {
        var evt = createEvent(type, data);
        if (typeof documentEventHandlers[type] != 'undefined') {
            documentEventHandlers[type].fire(evt);
        } else {
            document.dispatchEvent(evt);
        }
    },
    fireWindowEvent: function(type, data) {
        var evt = createEvent(type,data);
        if (typeof windowEventHandlers[type] != 'undefined') {
            windowEventHandlers[type].fire(evt);
        } else {
            window.dispatchEvent(evt);
        }
    },
    // TODO: this is Android only; think about how to do this better
    shuttingDown:false,
    UsePolling:false,
    // END TODO

    // TODO: iOS only
    // This queue holds the currently executing command and all pending
    // commands executed with cordova.exec().
    commandQueue:[],
    // Indicates if we're currently in the middle of flushing the command
    // queue on the native side.
    commandQueueFlushing:false,
    // END TODO
    /**
     * Plugin callback mechanism.
     */
    callbackId: 0,
    callbacks:  {},
    callbackStatus: {
        NO_RESULT: 0,
        OK: 1,
        CLASS_NOT_FOUND_EXCEPTION: 2,
        ILLEGAL_ACCESS_EXCEPTION: 3,
        INSTANTIATION_EXCEPTION: 4,
        MALFORMED_URL_EXCEPTION: 5,
        IO_EXCEPTION: 6,
        INVALID_ACTION: 7,
        JSON_EXCEPTION: 8,
        ERROR: 9
    },

    /**
     * Called by native code when returning successful result from an action.
     *
     * @param callbackId
     * @param args
     */
    callbackSuccess: function(callbackId, args) {
        if (cordova.callbacks[callbackId]) {

            // If result is to be sent to callback
            if (args.status == cordova.callbackStatus.OK) {
                try {
                    if (cordova.callbacks[callbackId].success) {
                        cordova.callbacks[callbackId].success(args.message);
                    }
                }
                catch (e) {
                    console.log("Error in success callback: "+callbackId+" = "+e);
                }
            }

            // Clear callback if not expecting any more results
            if (!args.keepCallback) {
                delete cordova.callbacks[callbackId];
            }
        }
    },

    /**
     * Called by native code when returning error result from an action.
     *
     * @param callbackId
     * @param args
     */
    callbackError: function(callbackId, args) {
        if (cordova.callbacks[callbackId]) {
            try {
                if (cordova.callbacks[callbackId].fail) {
                    cordova.callbacks[callbackId].fail(args.message);
                }
            }
            catch (e) {
                console.log("Error in error callback: "+callbackId+" = "+e);
            }

            // Clear callback if not expecting any more results
            if (!args.keepCallback) {
                delete cordova.callbacks[callbackId];
            }
        }
    },
    // TODO: remove in 2.0.
    addPlugin: function(name, obj) {
        console.log("[DEPRECATION NOTICE] window.addPlugin and window.plugins will be removed in version 2.0.");
        if (!window.plugins[name]) {
            window.plugins[name] = obj;
        }
        else {
            console.log("Error: Plugin "+name+" already exists.");
        }
    },

    addConstructor: function(func) {
        channel.onCordovaReady.subscribeOnce(function() {
            try {
                func();
            } catch(e) {
                console.log("Failed to run constructor: " + e);
            }
        });
    }
};

// Register pause, resume and deviceready channels as events on document.
channel.onPause = cordova.addDocumentEventHandler('pause');
channel.onResume = cordova.addDocumentEventHandler('resume');
channel.onDeviceReady = cordova.addDocumentEventHandler('deviceready');

// Adds deprecation warnings to functions of an object (but only logs a message once)
function deprecateFunctions(obj, objLabel) {
    var newObj = {};
    var logHash = {};
    for (var i in obj) {
        if (obj.hasOwnProperty(i)) {
            if (typeof obj[i] == 'function') {
                newObj[i] = (function(prop){
                    var oldFunk = obj[prop];
                    var funkId = objLabel + '_' + prop;
                    return function() {
                        if (!logHash[funkId]) {
                            console.log('[DEPRECATION NOTICE] The "' + objLabel + '" global will be removed in version 2.0, please use lowercase "cordova".');
                            logHash[funkId] = true;
                        }
                        oldFunk.apply(obj, arguments);
                    };
                })(i);
            } else {
                newObj[i] = (function(prop) { return obj[prop]; })(i);
            }
        }
    }
    return newObj;
}

/**
 * Legacy variable for plugin support
 * TODO: remove in 2.0.
 */
if (!window.PhoneGap) {
    window.PhoneGap = deprecateFunctions(cordova, 'PhoneGap');
}
if (!window.Cordova) {
    window.Cordova = deprecateFunctions(cordova, 'Cordova');
}

/**
 * Plugins object
 * TODO: remove in 2.0.
 */
if (!window.plugins) {
    window.plugins = {};
}

module.exports = cordova;

});

// file: lib/common/builder.js
define("cordova/builder", function(require, exports, module) {
var utils = require('cordova/utils');

function each(objects, func, context) {
    for (var prop in objects) {
        if (objects.hasOwnProperty(prop)) {
            func.apply(context, [objects[prop], prop]);
        }
    }
}

function include(parent, objects, clobber, merge) {
    each(objects, function (obj, key) {
        try {
          var result = obj.path ? require(obj.path) : {};

          if (clobber) {
              // Clobber if it doesn't exist.
              if (typeof parent[key] === 'undefined') {
                  parent[key] = result;
              } else if (typeof obj.path !== 'undefined') {
                  // If merging, merge properties onto parent, otherwise, clobber.
                  if (merge) {
                      recursiveMerge(parent[key], result);
                  } else {
                      parent[key] = result;
                  }
              }
              result = parent[key];
          } else {
            // Overwrite if not currently defined.
            if (typeof parent[key] == 'undefined') {
              parent[key] = result;
            } else if (merge && typeof obj.path !== 'undefined') {
              // If merging, merge parent onto result
              recursiveMerge(result, parent[key]);
              parent[key] = result;
            } else {
              // Set result to what already exists, so we can build children into it if they exist.
              result = parent[key];
            }
          }

          if (obj.children) {
            include(result, obj.children, clobber, merge);
          }
        } catch(e) {
          utils.alert('Exception building cordova JS globals: ' + e + ' for key "' + key + '"');
        }
    });
}

/**
 * Merge properties from one object onto another recursively.  Properties from
 * the src object will overwrite existing target property.
 *
 * @param target Object to merge properties into.
 * @param src Object to merge properties from.
 */
function recursiveMerge(target, src) {
    for (var prop in src) {
        if (src.hasOwnProperty(prop)) {
            if (typeof target.prototype !== 'undefined' && target.prototype.constructor === target) {
                // If the target object is a constructor override off prototype.
                target.prototype[prop] = src[prop];
            } else {
                target[prop] = typeof src[prop] === 'object' ? recursiveMerge(
                        target[prop], src[prop]) : src[prop];
            }
        }
    }
    return target;
}

module.exports = {
    build: function (objects) {
        return {
            intoButDontClobber: function (target) {
                include(target, objects, false, false);
            },
            intoAndClobber: function(target) {
                include(target, objects, true, false);
            },
            intoAndMerge: function(target) {
                include(target, objects, true, true);
            }
        };
    }
};

});

// file: lib/common/channel.js
define("cordova/channel", function(require, exports, module) {
var utils = require('cordova/utils');

/**
 * Custom pub-sub "channel" that can have functions subscribed to it
 * This object is used to define and control firing of events for
 * cordova initialization.
 *
 * The order of events during page load and Cordova startup is as follows:
 *
 * onDOMContentLoaded         Internal event that is received when the web page is loaded and parsed.
 * onNativeReady              Internal event that indicates the Cordova native side is ready.
 * onCordovaReady             Internal event fired when all Cordova JavaScript objects have been created.
 * onCordovaInfoReady         Internal event fired when device properties are available.
 * onCordovaConnectionReady   Internal event fired when the connection property has been set.
 * onDeviceReady              User event fired to indicate that Cordova is ready
 * onResume                   User event fired to indicate a start/resume lifecycle event
 * onPause                    User event fired to indicate a pause lifecycle event
 * onDestroy                  Internal event fired when app is being destroyed (User should use window.onunload event, not this one).
 *
 * The only Cordova events that user code should register for are:
 *      deviceready           Cordova native code is initialized and Cordova APIs can be called from JavaScript
 *      pause                 App has moved to background
 *      resume                App has returned to foreground
 *
 * Listeners can be registered as:
 *      document.addEventListener("deviceready", myDeviceReadyListener, false);
 *      document.addEventListener("resume", myResumeListener, false);
 *      document.addEventListener("pause", myPauseListener, false);
 *
 * The DOM lifecycle events should be used for saving and restoring state
 *      window.onload
 *      window.onunload
 *
 */

/**
 * Channel
 * @constructor
 * @param type  String the channel name
 * @param opts  Object options to pass into the channel, currently
 *                     supports:
 *                     onSubscribe: callback that fires when
 *                       something subscribes to the Channel. Sets
 *                       context to the Channel.
 *                     onUnsubscribe: callback that fires when
 *                       something unsubscribes to the Channel. Sets
 *                       context to the Channel.
 */
var Channel = function(type, opts) {
    this.type = type;
    this.handlers = {};
    this.numHandlers = 0;
    this.guid = 1;
    this.fired = false;
    this.enabled = true;
    this.events = {
        onSubscribe:null,
        onUnsubscribe:null
    };
    if (opts) {
        if (opts.onSubscribe) this.events.onSubscribe = opts.onSubscribe;
        if (opts.onUnsubscribe) this.events.onUnsubscribe = opts.onUnsubscribe;
    }
},
    channel = {
        /**
         * Calls the provided function only after all of the channels specified
         * have been fired.
         */
        join: function (h, c) {
            var i = c.length;
            var len = i;
            var f = function() {
                if (!(--i)) h();
            };
            for (var j=0; j<len; j++) {
                !c[j].fired?c[j].subscribeOnce(f):i--;
            }
            if (!i) h();
        },
        create: function (type, opts) {
            channel[type] = new Channel(type, opts);
            return channel[type];
        },

        /**
         * cordova Channels that must fire before "deviceready" is fired.
         */
        deviceReadyChannelsArray: [],
        deviceReadyChannelsMap: {},

        /**
         * Indicate that a feature needs to be initialized before it is ready to be used.
         * This holds up Cordova's "deviceready" event until the feature has been initialized
         * and Cordova.initComplete(feature) is called.
         *
         * @param feature {String}     The unique feature name
         */
        waitForInitialization: function(feature) {
            if (feature) {
                var c = null;
                if (this[feature]) {
                    c = this[feature];
                }
                else {
                    c = this.create(feature);
                }
                this.deviceReadyChannelsMap[feature] = c;
                this.deviceReadyChannelsArray.push(c);
            }
        },

        /**
         * Indicate that initialization code has completed and the feature is ready to be used.
         *
         * @param feature {String}     The unique feature name
         */
        initializationComplete: function(feature) {
            var c = this.deviceReadyChannelsMap[feature];
            if (c) {
                c.fire();
            }
        }
    };

function forceFunction(f) {
    if (f === null || f === undefined || typeof f != 'function') throw "Function required as first argument!";
}

/**
 * Subscribes the given function to the channel. Any time that
 * Channel.fire is called so too will the function.
 * Optionally specify an execution context for the function
 * and a guid that can be used to stop subscribing to the channel.
 * Returns the guid.
 */
Channel.prototype.subscribe = function(f, c, g) {
    // need a function to call
    forceFunction(f);

    var func = f;
    if (typeof c == "object") { func = utils.close(c, f); }

    g = g || func.observer_guid || f.observer_guid;
    if (!g) {
        // first time we've seen this subscriber
        g = this.guid++;
    }
    else {
        // subscriber already handled; dont set it twice
        return g;
    }
    func.observer_guid = g;
    f.observer_guid = g;
    this.handlers[g] = func;
    this.numHandlers++;
    if (this.events.onSubscribe) this.events.onSubscribe.call(this);
    if (this.fired) func.call(this);
    return g;
};

/**
 * Like subscribe but the function is only called once and then it
 * auto-unsubscribes itself.
 */
Channel.prototype.subscribeOnce = function(f, c) {
    // need a function to call
    forceFunction(f);

    var g = null;
    var _this = this;
    var m = function() {
        f.apply(c || null, arguments);
        _this.unsubscribe(g);
    };
    if (this.fired) {
        if (typeof c == "object") { f = utils.close(c, f); }
        f.apply(this, this.fireArgs);
    } else {
        g = this.subscribe(m);
    }
    return g;
};

/**
 * Unsubscribes the function with the given guid from the channel.
 */
Channel.prototype.unsubscribe = function(g) {
    // need a function to unsubscribe
    if (g === null || g === undefined) { throw "You must pass _something_ into Channel.unsubscribe"; }

    if (typeof g == 'function') { g = g.observer_guid; }
    var handler = this.handlers[g];
    if (handler) {
        if (handler.observer_guid) handler.observer_guid=null;
        this.handlers[g] = null;
        delete this.handlers[g];
        this.numHandlers--;
        if (this.events.onUnsubscribe) this.events.onUnsubscribe.call(this);
    }
};

/**
 * Calls all functions subscribed to this channel.
 */
Channel.prototype.fire = function(e) {
    if (this.enabled) {
        var fail = false;
        this.fired = true;
        for (var item in this.handlers) {
            var handler = this.handlers[item];
            if (typeof handler == 'function') {
                var rv = (handler.apply(this, arguments)===false);
                fail = fail || rv;
            }
        }
        this.fireArgs = arguments;
        return !fail;
    }
    return true;
};

// defining them here so they are ready super fast!
// DOM event that is received when the web page is loaded and parsed.
channel.create('onDOMContentLoaded');

// Event to indicate the Cordova native side is ready.
channel.create('onNativeReady');

// Event to indicate that all Cordova JavaScript objects have been created
// and it's time to run plugin constructors.
channel.create('onCordovaReady');

// Event to indicate that device properties are available
channel.create('onCordovaInfoReady');

// Event to indicate that the connection property has been set.
channel.create('onCordovaConnectionReady');

// Event to indicate that Cordova is ready
channel.create('onDeviceReady');

// Event to indicate a resume lifecycle event
channel.create('onResume');

// Event to indicate a pause lifecycle event
channel.create('onPause');

// Event to indicate a destroy lifecycle event
channel.create('onDestroy');

// Channels that must fire before "deviceready" is fired.
channel.waitForInitialization('onCordovaReady');
channel.waitForInitialization('onCordovaInfoReady');
channel.waitForInitialization('onCordovaConnectionReady');

module.exports = channel;

});

// file: lib/common/common.js
define("cordova/common", function(require, exports, module) {
module.exports = {
    objects: {
        cordova: {
            path: 'cordova',
            children: {
                exec: {
                    path: 'cordova/exec'
                },
                logger: {
                    path: 'cordova/plugin/logger'
                }
            }
        },
        Cordova: {
            children: {
                exec: {
                    path: 'cordova/exec'
                }
            }
        },
        PhoneGap:{
            children: {
                exec: {
                    path: 'cordova/exec'
                }
            }
        },
        navigator: {
            children: {
                notification: {
                    path: 'cordova/plugin/notification'
                },
                accelerometer: {
                    path: 'cordova/plugin/accelerometer'
                },
                battery: {
                    path: 'cordova/plugin/battery'
                },
                camera:{
                    path: 'cordova/plugin/Camera'
                },
                compass:{
                    path: 'cordova/plugin/compass'
                },
                contacts: {
                    path: 'cordova/plugin/contacts'
                },
                device:{
                    children:{
                        capture: {
                            path: 'cordova/plugin/capture'
                        }
                    }
                },
                geolocation: {
                    path: 'cordova/plugin/geolocation'
                },
                network: {
                    children: {
                        connection: {
                            path: 'cordova/plugin/network'
                        }
                    }
                },
                splashscreen: {
                    path: 'cordova/plugin/splashscreen'
                }
            }
        },
        Acceleration: {
            path: 'cordova/plugin/Acceleration'
        },
        Camera:{
            path: 'cordova/plugin/CameraConstants'
        },
        CameraPopoverOptions: {
            path: 'cordova/plugin/CameraPopoverOptions'
        },
        CaptureError: {
            path: 'cordova/plugin/CaptureError'
        },
        CaptureAudioOptions:{
            path: 'cordova/plugin/CaptureAudioOptions'
        },
        CaptureImageOptions: {
            path: 'cordova/plugin/CaptureImageOptions'
        },
        CaptureVideoOptions: {
            path: 'cordova/plugin/CaptureVideoOptions'
        },
        CompassHeading:{
            path: 'cordova/plugin/CompassHeading'
        },
        CompassError:{
            path: 'cordova/plugin/CompassError'
        },
        ConfigurationData: {
            path: 'cordova/plugin/ConfigurationData'
        },
        Connection: {
            path: 'cordova/plugin/Connection'
        },
        Contact: {
            path: 'cordova/plugin/Contact'
        },
        ContactAddress: {
            path: 'cordova/plugin/ContactAddress'
        },
        ContactError: {
            path: 'cordova/plugin/ContactError'
        },
        ContactField: {
            path: 'cordova/plugin/ContactField'
        },
        ContactFindOptions: {
            path: 'cordova/plugin/ContactFindOptions'
        },
        ContactName: {
            path: 'cordova/plugin/ContactName'
        },
        ContactOrganization: {
            path: 'cordova/plugin/ContactOrganization'
        },
        Coordinates: {
            path: 'cordova/plugin/Coordinates'
        },
        DirectoryEntry: {
            path: 'cordova/plugin/DirectoryEntry'
        },
        DirectoryReader: {
            path: 'cordova/plugin/DirectoryReader'
        },
        Entry: {
            path: 'cordova/plugin/Entry'
        },
        File: {
            path: 'cordova/plugin/File'
        },
        FileEntry: {
            path: 'cordova/plugin/FileEntry'
        },
        FileError: {
            path: 'cordova/plugin/FileError'
        },
        FileReader: {
            path: 'cordova/plugin/FileReader'
        },
        FileSystem: {
            path: 'cordova/plugin/FileSystem'
        },
        FileTransfer: {
            path: 'cordova/plugin/FileTransfer'
        },
        FileTransferError: {
            path: 'cordova/plugin/FileTransferError'
        },
        FileUploadOptions: {
            path: 'cordova/plugin/FileUploadOptions'
        },
        FileUploadResult: {
            path: 'cordova/plugin/FileUploadResult'
        },
        FileWriter: {
            path: 'cordova/plugin/FileWriter'
        },
        Flags: {
            path: 'cordova/plugin/Flags'
        },
        LocalFileSystem: {
            path: 'cordova/plugin/LocalFileSystem'
        },
        Media: {
            path: 'cordova/plugin/Media'
        },
        MediaError: {
            path: 'cordova/plugin/MediaError'
        },
        MediaFile: {
            path: 'cordova/plugin/MediaFile'
        },
        MediaFileData:{
            path: 'cordova/plugin/MediaFileData'
        },
        Metadata:{
            path: 'cordova/plugin/Metadata'
        },
        Position: {
            path: 'cordova/plugin/Position'
        },
        PositionError: {
            path: 'cordova/plugin/PositionError'
        },
        ProgressEvent: {
            path: 'cordova/plugin/ProgressEvent'
        },
        requestFileSystem:{
            path: 'cordova/plugin/requestFileSystem'
        },
        resolveLocalFileSystemURI:{
            path: 'cordova/plugin/resolveLocalFileSystemURI'
        }
    }
};

});

// file: lib/android/exec.js
define("cordova/exec", function(require, exports, module) {
/**
 * Execute a cordova command.  It is up to the native side whether this action
 * is synchronous or asynchronous.  The native side can return:
 *      Synchronous: PluginResult object as a JSON string
 *      Asynchrounous: Empty string ""
 * If async, the native side will cordova.callbackSuccess or cordova.callbackError,
 * depending upon the result of the action.
 *
 * @param {Function} success    The success callback
 * @param {Function} fail       The fail callback
 * @param {String} service      The name of the service to use
 * @param {String} action       Action to be run in cordova
 * @param {String[]} [args]     Zero or more arguments to pass to the method
 */
var cordova = require('cordova');

module.exports = function(success, fail, service, action, args) {
  try {
    var callbackId = service + cordova.callbackId++;
    if (success || fail) {
        cordova.callbacks[callbackId] = {success:success, fail:fail};
    }

    var r = prompt(JSON.stringify(args), "gap:"+JSON.stringify([service, action, callbackId, true]));

    // If a result was returned
    if (r.length > 0) {
        var v;
        eval("v="+r+";");

        // If status is OK, then return value back to caller
        if (v.status === cordova.callbackStatus.OK) {

            // If there is a success callback, then call it now with
            // returned value
            if (success) {
                try {
                    success(v.message);
                } catch (e) {
                    console.log("Error in success callback: " + callbackId  + " = " + e);
                }

                // Clear callback if not expecting any more results
                if (!v.keepCallback) {
                    delete cordova.callbacks[callbackId];
                }
            }
            return v.message;
        }

        // If no result
        else if (v.status === cordova.callbackStatus.NO_RESULT) {
            // Clear callback if not expecting any more results
            if (!v.keepCallback) {
                delete cordova.callbacks[callbackId];
            }
        }

        // If error, then display error
        else {
            console.log("Error: Status="+v.status+" Message="+v.message);

            // If there is a fail callback, then call it now with returned value
            if (fail) {
                try {
                    fail(v.message);
                }
                catch (e1) {
                    console.log("Error in error callback: "+callbackId+" = "+e1);
                }

                // Clear callback if not expecting any more results
                if (!v.keepCallback) {
                    delete cordova.callbacks[callbackId];
                }
            }
            return null;
        }
    }
  } catch (e2) {
    console.log("Error: "+e2);
  }
};

});

// file: lib/android/platform.js
define("cordova/platform", function(require, exports, module) {
module.exports = {
    id: "android",
    initialize:function() {
        var channel = require("cordova/channel"),
            cordova = require('cordova'),
            callback = require('cordova/plugin/android/callback'),
            polling = require('cordova/plugin/android/polling'),
            exec = require('cordova/exec');

        channel.onDestroy.subscribe(function() {
            cordova.shuttingDown = true;
        });

        // Start listening for XHR callbacks
        // Figure out which bridge approach will work on this Android
        // device: polling or XHR-based callbacks
        setTimeout(function() {
            if (cordova.UsePolling) {
                polling();
            }
            else {
                var isPolling = prompt("usePolling", "gap_callbackServer:");
                cordova.UsePolling = isPolling;
                if (isPolling == "true") {
                    cordova.UsePolling = true;
                    polling();
                } else {
                    cordova.UsePolling = false;
                    callback();
                }
            }
        }, 1);

        // Inject a listener for the backbutton on the document.
        var backButtonChannel = cordova.addDocumentEventHandler('backbutton', {
            onSubscribe:function() {
                // If we just attached the first handler, let native know we need to override the back button.
                if (this.numHandlers === 1) {
                    exec(null, null, "App", "overrideBackbutton", [true]);
                }
            },
            onUnsubscribe:function() {
                // If we just detached the last handler, let native know we no longer override the back button.
                if (this.numHandlers === 0) {
                    exec(null, null, "App", "overrideBackbutton", [false]);
                }
            }
        });

        // Add hardware MENU and SEARCH button handlers
        cordova.addDocumentEventHandler('menubutton');
        cordova.addDocumentEventHandler('searchbutton');

        // Figure out if we need to shim-in localStorage and WebSQL
        // support from the native side.
        var storage = require('cordova/plugin/android/storage');

        // First patch WebSQL if necessary
        if (typeof window.openDatabase == 'undefined') {
            // Not defined, create an openDatabase function for all to use!
            window.openDatabase = storage.openDatabase;
        } else {
            // Defined, but some Android devices will throw a SECURITY_ERR -
            // so we wrap the whole thing in a try-catch and shim in our own
            // if the device has Android bug 16175.
            var originalOpenDatabase = window.openDatabase;
            window.openDatabase = function(name, version, desc, size) {
                var db = null;
                try {
                    db = originalOpenDatabase(name, version, desc, size);
                }
                catch (ex) {
                    if (ex.code === 18) {
                        db = null;
                    } else {
                        throw ex;
                    }
                }

                if (db === null) {
                    return storage.openDatabase(name, version, desc, size);
                }
                else {
                    return db;
                }

            };
        }

        // Patch localStorage if necessary
        if (typeof window.localStorage == 'undefined' || window.localStorage === null) {
            window.localStorage = new storage.CupcakeLocalStorage();
        }

        // Let native code know we are all done on the JS side.
        // Native code will then un-hide the WebView.
        channel.join(function() {
            prompt("", "gap_init:");
        }, [channel.onCordovaReady]);
    },
    objects: {
        cordova: {
            children: {
                JSCallback:{
                    path:"cordova/plugin/android/callback"
                },
                JSCallbackPolling:{
                    path:"cordova/plugin/android/polling"
                }
            }
        },
        navigator: {
            children: {
                app:{
                    path: "cordova/plugin/android/app"
                }
            }
        },
        device:{
            path: "cordova/plugin/android/device"
        },
        File: { // exists natively on Android WebView, override
            path: "cordova/plugin/File"
        },
        FileReader: { // exists natively on Android WebView, override
            path: "cordova/plugin/FileReader"
        },
        FileError: { //exists natively on Android WebView on Android 4.x
            path: "cordova/plugin/FileError"
        },
        MediaError: { // exists natively on Android WebView on Android 4.x
            path: "cordova/plugin/MediaError"
        }
    },
    merges: {
        navigator: {
            children: {
                notification: {
                    path: 'cordova/plugin/android/notification'
                }
            }
        }
    }
};

});

// file: lib/common/plugin/Acceleration.js
define("cordova/plugin/Acceleration", function(require, exports, module) {
var Acceleration = function(x, y, z, timestamp) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.timestamp = timestamp || (new Date()).getTime();
};

module.exports = Acceleration;

});

// file: lib/common/plugin/Camera.js
define("cordova/plugin/Camera", function(require, exports, module) {
var exec = require('cordova/exec'),
    Camera = require('cordova/plugin/CameraConstants');

var cameraExport = {};

// Tack on the Camera Constants to the base camera plugin.
for (var key in Camera) {
    cameraExport[key] = Camera[key];
}

/**
 * Gets a picture from source defined by "options.sourceType", and returns the
 * image as defined by the "options.destinationType" option.

 * The defaults are sourceType=CAMERA and destinationType=FILE_URI.
 *
 * @param {Function} successCallback
 * @param {Function} errorCallback
 * @param {Object} options
 */
cameraExport.getPicture = function(successCallback, errorCallback, options) {
    // successCallback required
    if (typeof successCallback != "function") {
        console.log("Camera Error: successCallback is not a function");
        return;
    }

    // errorCallback optional
    if (errorCallback && (typeof errorCallback != "function")) {
        console.log("Camera Error: errorCallback is not a function");
        return;
    }

    var quality = 50;
    if (options && typeof options.quality == "number") {
        quality = options.quality;
    } else if (options && typeof options.quality == "string") {
        var qlity = parseInt(options.quality, 10);
        if (isNaN(qlity) === false) {
            quality = qlity.valueOf();
        }
    }

    var destinationType = Camera.DestinationType.FILE_URI;
    if (typeof options.destinationType == "number") {
        destinationType = options.destinationType;
    }

    var sourceType = Camera.PictureSourceType.CAMERA;
    if (typeof options.sourceType == "number") {
        sourceType = options.sourceType;
    }

    var targetWidth = -1;
    if (typeof options.targetWidth == "number") {
        targetWidth = options.targetWidth;
    } else if (typeof options.targetWidth == "string") {
        var width = parseInt(options.targetWidth, 10);
        if (isNaN(width) === false) {
            targetWidth = width.valueOf();
        }
    }

    var targetHeight = -1;
    if (typeof options.targetHeight == "number") {
        targetHeight = options.targetHeight;
    } else if (typeof options.targetHeight == "string") {
        var height = parseInt(options.targetHeight, 10);
        if (isNaN(height) === false) {
            targetHeight = height.valueOf();
        }
    }

    var encodingType = Camera.EncodingType.JPEG;
    if (typeof options.encodingType == "number") {
        encodingType = options.encodingType;
    }

    var mediaType = Camera.MediaType.PICTURE;
    if (typeof options.mediaType == "number") {
        mediaType = options.mediaType;
    }
    var allowEdit = false;
    if (typeof options.allowEdit == "boolean") {
        allowEdit = options.allowEdit;
    } else if (typeof options.allowEdit == "number") {
        allowEdit = options.allowEdit <= 0 ? false : true;
    }
    var correctOrientation = false;
    if (typeof options.correctOrientation == "boolean") {
        correctOrientation = options.correctOrientation;
    } else if (typeof options.correctOrientation == "number") {
        correctOrientation = options.correctOrientation <=0 ? false : true;
    }
    var saveToPhotoAlbum = false;
    if (typeof options.saveToPhotoAlbum == "boolean") {
        saveToPhotoAlbum = options.saveToPhotoAlbum;
    } else if (typeof options.saveToPhotoAlbum == "number") {
        saveToPhotoAlbum = options.saveToPhotoAlbum <=0 ? false : true;
    }
    var popoverOptions = null;
    if (typeof options.popoverOptions == "object") {
        popoverOptions = options.popoverOptions;
    }

    exec(successCallback, errorCallback, "Camera", "takePicture", [quality, destinationType, sourceType, targetWidth, targetHeight, encodingType, mediaType, allowEdit, correctOrientation, saveToPhotoAlbum, popoverOptions]);
};

cameraExport.cleanup = function(successCallback, errorCallback) {
    exec(successCallback, errorCallback, "Camera", "cleanup", []);
}

module.exports = cameraExport;
});

// file: lib/common/plugin/CameraConstants.js
define("cordova/plugin/CameraConstants", function(require, exports, module) {
module.exports = {
  DestinationType:{
    DATA_URL: 0,         // Return base64 encoded string
    FILE_URI: 1          // Return file uri (content://media/external/images/media/2 for Android)
  },
  EncodingType:{
    JPEG: 0,             // Return JPEG encoded image
    PNG: 1               // Return PNG encoded image
  },
  MediaType:{
    PICTURE: 0,          // allow selection of still pictures only. DEFAULT. Will return format specified via DestinationType
    VIDEO: 1,            // allow selection of video only, ONLY RETURNS URL
    ALLMEDIA : 2         // allow selection from all media types
  },
  PictureSourceType:{
    PHOTOLIBRARY : 0,    // Choose image from picture library (same as SAVEDPHOTOALBUM for Android)
    CAMERA : 1,          // Take picture from camera
    SAVEDPHOTOALBUM : 2  // Choose image from picture library (same as PHOTOLIBRARY for Android)
  },
  PopoverArrowDirection:{
      ARROW_UP : 1,        // matches iOS UIPopoverArrowDirection constants to specify arrow location on popover
      ARROW_DOWN : 2,
      ARROW_LEFT : 4,
      ARROW_RIGHT : 8,
      ARROW_ANY : 15
  }
};
});

// file: lib/common/plugin/CameraPopoverOptions.js
define("cordova/plugin/CameraPopoverOptions", function(require, exports, module) {
var Camera = require('cordova/plugin/CameraConstants');

/**
 * Encapsulates options for iOS Popover image picker
 */
var CameraPopoverOptions = function(x,y,width,height,arrowDir){
    // information of rectangle that popover should be anchored to
    this.x = x || 0;
    this.y = y || 32;
    this.width = width || 320;
    this.height = height || 480;
    // The direction of the popover arrow
    this.arrowDir = arrowDir || Camera.PopoverArrowDirection.ARROW_ANY;
};

module.exports = CameraPopoverOptions;
});

// file: lib/common/plugin/CaptureAudioOptions.js
define("cordova/plugin/CaptureAudioOptions", function(require, exports, module) {
/**
 * Encapsulates all audio capture operation configuration options.
 */
var CaptureAudioOptions = function(){
    // Upper limit of sound clips user can record. Value must be equal or greater than 1.
    this.limit = 1;
    // Maximum duration of a single sound clip in seconds.
    this.duration = 0;
    // The selected audio mode. Must match with one of the elements in supportedAudioModes array.
    this.mode = null;
};

module.exports = CaptureAudioOptions;
});

// file: lib/common/plugin/CaptureError.js
define("cordova/plugin/CaptureError", function(require, exports, module) {
/**
 * The CaptureError interface encapsulates all errors in the Capture API.
 */
var CaptureError = function(c) {
   this.code = c || null;
};

// Camera or microphone failed to capture image or sound.
CaptureError.CAPTURE_INTERNAL_ERR = 0;
// Camera application or audio capture application is currently serving other capture request.
CaptureError.CAPTURE_APPLICATION_BUSY = 1;
// Invalid use of the API (e.g. limit parameter has value less than one).
CaptureError.CAPTURE_INVALID_ARGUMENT = 2;
// User exited camera application or audio capture application before capturing anything.
CaptureError.CAPTURE_NO_MEDIA_FILES = 3;
// The requested capture operation is not supported.
CaptureError.CAPTURE_NOT_SUPPORTED = 20;

module.exports = CaptureError;
});

// file: lib/common/plugin/CaptureImageOptions.js
define("cordova/plugin/CaptureImageOptions", function(require, exports, module) {
/**
 * Encapsulates all image capture operation configuration options.
 */
var CaptureImageOptions = function(){
    // Upper limit of images user can take. Value must be equal or greater than 1.
    this.limit = 1;
    // The selected image mode. Must match with one of the elements in supportedImageModes array.
    this.mode = null;
};

module.exports = CaptureImageOptions;
});

// file: lib/common/plugin/CaptureVideoOptions.js
define("cordova/plugin/CaptureVideoOptions", function(require, exports, module) {
/**
 * Encapsulates all video capture operation configuration options.
 */
var CaptureVideoOptions = function(){
    // Upper limit of videos user can record. Value must be equal or greater than 1.
    this.limit = 1;
    // Maximum duration of a single video clip in seconds.
    this.duration = 0;
    // The selected video mode. Must match with one of the elements in supportedVideoModes array.
    this.mode = null;
};

module.exports = CaptureVideoOptions;
});

// file: lib/common/plugin/CompassError.js
define("cordova/plugin/CompassError", function(require, exports, module) {
/**
 *  CompassError.
 *  An error code assigned by an implementation when an error has occured
 * @constructor
 */
var CompassError = function(err) {
    this.code = (err !== undefined ? err : null);
};

CompassError.COMPASS_INTERNAL_ERR = 0;
CompassError.COMPASS_NOT_SUPPORTED = 20;

module.exports = CompassError;
});

// file: lib/common/plugin/CompassHeading.js
define("cordova/plugin/CompassHeading", function(require, exports, module) {
var CompassHeading = function(magneticHeading, trueHeading, headingAccuracy, timestamp) {
  this.magneticHeading = (magneticHeading !== undefined ? magneticHeading : null);
  this.trueHeading = (trueHeading !== undefined ? trueHeading : null);
  this.headingAccuracy = (headingAccuracy !== undefined ? headingAccuracy : null);
  this.timestamp = (timestamp !== undefined ? timestamp : new Date().getTime());
};

module.exports = CompassHeading;
});

// file: lib/common/plugin/ConfigurationData.js
define("cordova/plugin/ConfigurationData", function(require, exports, module) {
/**
 * Encapsulates a set of parameters that the capture device supports.
 */
function ConfigurationData() {
    // The ASCII-encoded string in lower case representing the media type.
    this.type = null;
    // The height attribute represents height of the image or video in pixels.
    // In the case of a sound clip this attribute has value 0.
    this.height = 0;
    // The width attribute represents width of the image or video in pixels.
    // In the case of a sound clip this attribute has value 0
    this.width = 0;
}

module.exports = ConfigurationData;
});

// file: lib/common/plugin/Connection.js
define("cordova/plugin/Connection", function(require, exports, module) {
/**
 * Network status
 */
module.exports = {
        UNKNOWN: "unknown",
        ETHERNET: "ethernet",
        WIFI: "wifi",
        CELL_2G: "2g",
        CELL_3G: "3g",
        CELL_4G: "4g",
        NONE: "none"
};
});

// file: lib/common/plugin/Contact.js
define("cordova/plugin/Contact", function(require, exports, module) {
var exec = require('cordova/exec'),
    ContactError = require('cordova/plugin/ContactError'),
    utils = require('cordova/utils');

/**
* Converts primitives into Complex Object
* Currently only used for Date fields
*/
function convertIn(contact) {
    var value = contact.birthday;
    try {
      contact.birthday = new Date(parseFloat(value));
    } catch (exception){
      console.log("Cordova Contact convertIn error: exception creating date.");
    }
    return contact;
}

/**
* Converts Complex objects into primitives
* Only conversion at present is for Dates.
**/

function convertOut(contact) {
    var value = contact.birthday;
    if (value !== null) {
        // try to make it a Date object if it is not already
        if (!utils.isDate(value)){
            try {
                value = new Date(value);
            } catch(exception){
                value = null;
            }
        }
        if (utils.isDate(value)){
            value = value.valueOf(); // convert to milliseconds
        }
        contact.birthday = value;
    }
    return contact;
}

/**
* Contains information about a single contact.
* @constructor
* @param {DOMString} id unique identifier
* @param {DOMString} displayName
* @param {ContactName} name
* @param {DOMString} nickname
* @param {Array.<ContactField>} phoneNumbers array of phone numbers
* @param {Array.<ContactField>} emails array of email addresses
* @param {Array.<ContactAddress>} addresses array of addresses
* @param {Array.<ContactField>} ims instant messaging user ids
* @param {Array.<ContactOrganization>} organizations
* @param {DOMString} birthday contact's birthday
* @param {DOMString} note user notes about contact
* @param {Array.<ContactField>} photos
* @param {Array.<ContactField>} categories
* @param {Array.<ContactField>} urls contact's web sites
*/
var Contact = function (id, displayName, name, nickname, phoneNumbers, emails, addresses,
    ims, organizations, birthday, note, photos, categories, urls) {
    this.id = id || null;
    this.rawId = null;
    this.displayName = displayName || null;
    this.name = name || null; // ContactName
    this.nickname = nickname || null;
    this.phoneNumbers = phoneNumbers || null; // ContactField[]
    this.emails = emails || null; // ContactField[]
    this.addresses = addresses || null; // ContactAddress[]
    this.ims = ims || null; // ContactField[]
    this.organizations = organizations || null; // ContactOrganization[]
    this.birthday = birthday || null;
    this.note = note || null;
    this.photos = photos || null; // ContactField[]
    this.categories = categories || null; // ContactField[]
    this.urls = urls || null; // ContactField[]
};

/**
* Removes contact from device storage.
* @param successCB success callback
* @param errorCB error callback
*/
Contact.prototype.remove = function(successCB, errorCB) {
    var fail = function(code) {
        errorCB(new ContactError(code));
    };
    if (this.id === null) {
        fail(ContactError.UNKNOWN_ERROR);
    }
    else {
        exec(successCB, fail, "Contacts", "remove", [this.id]);
    }
};

/**
* Creates a deep copy of this Contact.
* With the contact ID set to null.
* @return copy of this Contact
*/
Contact.prototype.clone = function() {
    var clonedContact = utils.clone(this);
    var i;
    clonedContact.id = null;
    clonedContact.rawId = null;
    // Loop through and clear out any id's in phones, emails, etc.
    if (clonedContact.phoneNumbers) {
        for (i = 0; i < clonedContact.phoneNumbers.length; i++) {
            clonedContact.phoneNumbers[i].id = null;
        }
    }
    if (clonedContact.emails) {
        for (i = 0; i < clonedContact.emails.length; i++) {
            clonedContact.emails[i].id = null;
        }
    }
    if (clonedContact.addresses) {
        for (i = 0; i < clonedContact.addresses.length; i++) {
            clonedContact.addresses[i].id = null;
        }
    }
    if (clonedContact.ims) {
        for (i = 0; i < clonedContact.ims.length; i++) {
            clonedContact.ims[i].id = null;
        }
    }
    if (clonedContact.organizations) {
        for (i = 0; i < clonedContact.organizations.length; i++) {
            clonedContact.organizations[i].id = null;
        }
    }
    if (clonedContact.categories) {
        for (i = 0; i < clonedContact.categories.length; i++) {
            clonedContact.categories[i].id = null;
        }
    }
    if (clonedContact.photos) {
        for (i = 0; i < clonedContact.photos.length; i++) {
            clonedContact.photos[i].id = null;
        }
    }
    if (clonedContact.urls) {
        for (i = 0; i < clonedContact.urls.length; i++) {
            clonedContact.urls[i].id = null;
        }
    }
    return clonedContact;
};

/**
* Persists contact to device storage.
* @param successCB success callback
* @param errorCB error callback
*/
Contact.prototype.save = function(successCB, errorCB) {
  var fail = function(code) {
      errorCB(new ContactError(code));
  };
    var success = function(result) {
      if (result) {
          if (typeof successCB === 'function') {
              var fullContact = require('cordova/plugin/contacts').create(result);
              successCB(convertIn(fullContact));
          }
      }
      else {
          // no Entry object returned
          fail(ContactError.UNKNOWN_ERROR);
      }
  };
    var dupContact = convertOut(utils.clone(this));
    exec(success, fail, "Contacts", "save", [dupContact]);
};


module.exports = Contact;

});

// file: lib/common/plugin/ContactAddress.js
define("cordova/plugin/ContactAddress", function(require, exports, module) {
/**
* Contact address.
* @constructor
* @param {DOMString} id unique identifier, should only be set by native code
* @param formatted // NOTE: not a W3C standard
* @param streetAddress
* @param locality
* @param region
* @param postalCode
* @param country
*/

var ContactAddress = function(pref, type, formatted, streetAddress, locality, region, postalCode, country) {
    this.id = null;
    this.pref = (typeof pref != 'undefined' ? pref : false);
    this.type = type || null;
    this.formatted = formatted || null;
    this.streetAddress = streetAddress || null;
    this.locality = locality || null;
    this.region = region || null;
    this.postalCode = postalCode || null;
    this.country = country || null;
};

module.exports = ContactAddress;
});

// file: lib/common/plugin/ContactError.js
define("cordova/plugin/ContactError", function(require, exports, module) {
/**
 *  ContactError.
 *  An error code assigned by an implementation when an error has occured
 * @constructor
 */
var ContactError = function(err) {
    this.code = (typeof err != 'undefined' ? err : null);
};

/**
 * Error codes
 */
ContactError.UNKNOWN_ERROR = 0;
ContactError.INVALID_ARGUMENT_ERROR = 1;
ContactError.TIMEOUT_ERROR = 2;
ContactError.PENDING_OPERATION_ERROR = 3;
ContactError.IO_ERROR = 4;
ContactError.NOT_SUPPORTED_ERROR = 5;
ContactError.PERMISSION_DENIED_ERROR = 20;

module.exports = ContactError;
});

// file: lib/common/plugin/ContactField.js
define("cordova/plugin/ContactField", function(require, exports, module) {
/**
* Generic contact field.
* @constructor
* @param {DOMString} id unique identifier, should only be set by native code // NOTE: not a W3C standard
* @param type
* @param value
* @param pref
*/
var ContactField = function(type, value, pref) {
    this.id = null;
    this.type = (type && type.toString()) || null;
    this.value = (value && value.toString()) || null;
    this.pref = (typeof pref != 'undefined' ? pref : false);
};

module.exports = ContactField;
});

// file: lib/common/plugin/ContactFindOptions.js
define("cordova/plugin/ContactFindOptions", function(require, exports, module) {
/**
 * ContactFindOptions.
 * @constructor
 * @param filter used to match contacts against
 * @param multiple boolean used to determine if more than one contact should be returned
 */

var ContactFindOptions = function(filter, multiple) {
    this.filter = filter || '';
    this.multiple = (typeof multiple != 'undefined' ? multiple : false);
};

module.exports = ContactFindOptions;
});

// file: lib/common/plugin/ContactName.js
define("cordova/plugin/ContactName", function(require, exports, module) {
/**
* Contact name.
* @constructor
* @param formatted // NOTE: not part of W3C standard
* @param familyName
* @param givenName
* @param middle
* @param prefix
* @param suffix
*/
var ContactName = function(formatted, familyName, givenName, middle, prefix, suffix) {
    this.formatted = formatted || null;
    this.familyName = familyName || null;
    this.givenName = givenName || null;
    this.middleName = middle || null;
    this.honorificPrefix = prefix || null;
    this.honorificSuffix = suffix || null;
};

module.exports = ContactName;
});

// file: lib/common/plugin/ContactOrganization.js
define("cordova/plugin/ContactOrganization", function(require, exports, module) {
/**
* Contact organization.
* @constructor
* @param {DOMString} id unique identifier, should only be set by native code // NOTE: not a W3C standard
* @param name
* @param dept
* @param title
* @param startDate
* @param endDate
* @param location
* @param desc
*/

var ContactOrganization = function(pref, type, name, dept, title) {
    this.id = null;
    this.pref = (typeof pref != 'undefined' ? pref : false);
    this.type = type || null;
    this.name = name || null;
    this.department = dept || null;
    this.title = title || null;
};

module.exports = ContactOrganization;
});

// file: lib/common/plugin/Coordinates.js
define("cordova/plugin/Coordinates", function(require, exports, module) {
/**
 * This class contains position information.
 * @param {Object} lat
 * @param {Object} lng
 * @param {Object} alt
 * @param {Object} acc
 * @param {Object} head
 * @param {Object} vel
 * @param {Object} altacc
 * @constructor
 */
var Coordinates = function(lat, lng, alt, acc, head, vel, altacc) {
    /**
     * The latitude of the position.
     */
    this.latitude = lat;
    /**
     * The longitude of the position,
     */
    this.longitude = lng;
    /**
     * The accuracy of the position.
     */
    this.accuracy = acc;
    /**
     * The altitude of the position.
     */
    this.altitude = (alt !== undefined ? alt : null);
    /**
     * The direction the device is moving at the position.
     */
    this.heading = (head !== undefined ? head : null);
    /**
     * The velocity with which the device is moving at the position.
     */
    this.speed = (vel !== undefined ? vel : null);

    if (this.speed === 0 || this.speed === null) {
        this.heading = NaN;
    }

    /**
     * The altitude accuracy of the position.
     */
    this.altitudeAccuracy = (altacc !== undefined) ? altacc : null;
};

module.exports = Coordinates;

});

// file: lib/common/plugin/DirectoryEntry.js
define("cordova/plugin/DirectoryEntry", function(require, exports, module) {
var utils = require('cordova/utils'),
    exec = require('cordova/exec'),
    Entry = require('cordova/plugin/Entry'),
    FileError = require('cordova/plugin/FileError'),
    DirectoryReader = require('cordova/plugin/DirectoryReader');

/**
 * An interface representing a directory on the file system.
 *
 * {boolean} isFile always false (readonly)
 * {boolean} isDirectory always true (readonly)
 * {DOMString} name of the directory, excluding the path leading to it (readonly)
 * {DOMString} fullPath the absolute full path to the directory (readonly)
 * {FileSystem} filesystem on which the directory resides (readonly)
 */
var DirectoryEntry = function(name, fullPath) {
     DirectoryEntry.__super__.constructor.apply(this, [false, true, name, fullPath]);
};

utils.extend(DirectoryEntry, Entry);

/**
 * Creates a new DirectoryReader to read entries from this directory
 */
DirectoryEntry.prototype.createReader = function() {
    return new DirectoryReader(this.fullPath);
};

/**
 * Creates or looks up a directory
 *
 * @param {DOMString} path either a relative or absolute path from this directory in which to look up or create a directory
 * @param {Flags} options to create or excluively create the directory
 * @param {Function} successCallback is called with the new entry
 * @param {Function} errorCallback is called with a FileError
 */
DirectoryEntry.prototype.getDirectory = function(path, options, successCallback, errorCallback) {
    var win = typeof successCallback !== 'function' ? null : function(result) {
        var entry = new DirectoryEntry(result.name, result.fullPath);
        successCallback(entry);
    };
    var fail = typeof errorCallback !== 'function' ? null : function(code) {
        errorCallback(new FileError(code));
    };
    exec(win, fail, "File", "getDirectory", [this.fullPath, path, options]);
};

/**
 * Deletes a directory and all of it's contents
 *
 * @param {Function} successCallback is called with no parameters
 * @param {Function} errorCallback is called with a FileError
 */
DirectoryEntry.prototype.removeRecursively = function(successCallback, errorCallback) {
    var fail = typeof errorCallback !== 'function' ? null : function(code) {
        errorCallback(new FileError(code));
    };
    exec(successCallback, fail, "File", "removeRecursively", [this.fullPath]);
};

/**
 * Creates or looks up a file
 *
 * @param {DOMString} path either a relative or absolute path from this directory in which to look up or create a file
 * @param {Flags} options to create or excluively create the file
 * @param {Function} successCallback is called with the new entry
 * @param {Function} errorCallback is called with a FileError
 */
DirectoryEntry.prototype.getFile = function(path, options, successCallback, errorCallback) {
    var win = typeof successCallback !== 'function' ? null : function(result) {
        var FileEntry = require('cordova/plugin/FileEntry');
        var entry = new FileEntry(result.name, result.fullPath);
        successCallback(entry);
    };
    var fail = typeof errorCallback !== 'function' ? null : function(code) {
        errorCallback(new FileError(code));
    };
    exec(win, fail, "File", "getFile", [this.fullPath, path, options]);
};

module.exports = DirectoryEntry;

});

// file: lib/common/plugin/DirectoryReader.js
define("cordova/plugin/DirectoryReader", function(require, exports, module) {
var exec = require('cordova/exec'),
    FileError = require('cordova/plugin/FileError') ;

/**
 * An interface that lists the files and directories in a directory.
 */
function DirectoryReader(path) {
    this.path = path || null;
}

/**
 * Returns a list of entries from a directory.
 *
 * @param {Function} successCallback is called with a list of entries
 * @param {Function} errorCallback is called with a FileError
 */
DirectoryReader.prototype.readEntries = function(successCallback, errorCallback) {
    var win = typeof successCallback !== 'function' ? null : function(result) {
        var retVal = [];
        for (var i=0; i<result.length; i++) {
            var entry = null;
            if (result[i].isDirectory) {
                entry = new (require('cordova/plugin/DirectoryEntry'))();
            }
            else if (result[i].isFile) {
                entry = new (require('cordova/plugin/FileEntry'))();
            }
            entry.isDirectory = result[i].isDirectory;
            entry.isFile = result[i].isFile;
            entry.name = result[i].name;
            entry.fullPath = result[i].fullPath;
            retVal.push(entry);
        }
        successCallback(retVal);
    };
    var fail = typeof errorCallback !== 'function' ? null : function(code) {
        errorCallback(new FileError(code));
    };
    exec(win, fail, "File", "readEntries", [this.path]);
};

module.exports = DirectoryReader;

});

// file: lib/common/plugin/Entry.js
define("cordova/plugin/Entry", function(require, exports, module) {
var exec = require('cordova/exec'),
    FileError = require('cordova/plugin/FileError'),
    Metadata = require('cordova/plugin/Metadata');

/**
 * Represents a file or directory on the local file system.
 *
 * @param isFile
 *            {boolean} true if Entry is a file (readonly)
 * @param isDirectory
 *            {boolean} true if Entry is a directory (readonly)
 * @param name
 *            {DOMString} name of the file or directory, excluding the path
 *            leading to it (readonly)
 * @param fullPath
 *            {DOMString} the absolute full path to the file or directory
 *            (readonly)
 */
function Entry(isFile, isDirectory, name, fullPath, fileSystem) {
    this.isFile = (typeof isFile != 'undefined'?isFile:false);
    this.isDirectory = (typeof isDirectory != 'undefined'?isDirectory:false);
    this.name = name || '';
    this.fullPath = fullPath || '';
    this.filesystem = fileSystem || null;
}

/**
 * Look up the metadata of the entry.
 *
 * @param successCallback
 *            {Function} is called with a Metadata object
 * @param errorCallback
 *            {Function} is called with a FileError
 */
Entry.prototype.getMetadata = function(successCallback, errorCallback) {
  var success = typeof successCallback !== 'function' ? null : function(lastModified) {
      var metadata = new Metadata(lastModified);
      successCallback(metadata);
  };
  var fail = typeof errorCallback !== 'function' ? null : function(code) {
      errorCallback(new FileError(code));
  };

  exec(success, fail, "File", "getMetadata", [this.fullPath]);
};

/**
 * Set the metadata of the entry.
 *
 * @param successCallback
 *            {Function} is called with a Metadata object
 * @param errorCallback
 *            {Function} is called with a FileError
 * @param metadataObject
 *            {Object} keys and values to set
 */
Entry.prototype.setMetadata = function(successCallback, errorCallback, metadataObject) {

  exec(successCallback, errorCallback, "File", "setMetadata", [this.fullPath, metadataObject]);
};

/**
 * Move a file or directory to a new location.
 *
 * @param parent
 *            {DirectoryEntry} the directory to which to move this entry
 * @param newName
 *            {DOMString} new name of the entry, defaults to the current name
 * @param successCallback
 *            {Function} called with the new DirectoryEntry object
 * @param errorCallback
 *            {Function} called with a FileError
 */
Entry.prototype.moveTo = function(parent, newName, successCallback, errorCallback) {
    var fail = function(code) {
        if (typeof errorCallback === 'function') {
            errorCallback(new FileError(code));
        }
    };
    // user must specify parent Entry
    if (!parent) {
        fail(FileError.NOT_FOUND_ERR);
        return;
    }
    // source path
    var srcPath = this.fullPath,
        // entry name
        name = newName || this.name,
        success = function(entry) {
            if (entry) {
                if (typeof successCallback === 'function') {
                    // create appropriate Entry object
                    var result = (entry.isDirectory) ? new (require('cordova/plugin/DirectoryEntry'))(entry.name, entry.fullPath) : new (require('cordova/plugin/FileEntry'))(entry.name, entry.fullPath);
                    try {
                        successCallback(result);
                    }
                    catch (e) {
                        console.log('Error invoking callback: ' + e);
                    }
                }
            }
            else {
                // no Entry object returned
                fail(FileError.NOT_FOUND_ERR);
            }
        };

    // copy
    exec(success, fail, "File", "moveTo", [srcPath, parent.fullPath, name]);
};

/**
 * Copy a directory to a different location.
 *
 * @param parent
 *            {DirectoryEntry} the directory to which to copy the entry
 * @param newName
 *            {DOMString} new name of the entry, defaults to the current name
 * @param successCallback
 *            {Function} called with the new Entry object
 * @param errorCallback
 *            {Function} called with a FileError
 */
Entry.prototype.copyTo = function(parent, newName, successCallback, errorCallback) {
    var fail = function(code) {
        if (typeof errorCallback === 'function') {
            errorCallback(new FileError(code));
        }
    };

    // user must specify parent Entry
    if (!parent) {
        fail(FileError.NOT_FOUND_ERR);
        return;
    }

        // source path
    var srcPath = this.fullPath,
        // entry name
        name = newName || this.name,
        // success callback
        success = function(entry) {
            if (entry) {
                if (typeof successCallback === 'function') {
                    // create appropriate Entry object
                    var result = (entry.isDirectory) ? new (require('cordova/plugin/DirectoryEntry'))(entry.name, entry.fullPath) : new (require('cordova/plugin/FileEntry'))(entry.name, entry.fullPath);
                    try {
                        successCallback(result);
                    }
                    catch (e) {
                        console.log('Error invoking callback: ' + e);
                    }
                }
            }
            else {
                // no Entry object returned
                fail(FileError.NOT_FOUND_ERR);
            }
        };

    // copy
    exec(success, fail, "File", "copyTo", [srcPath, parent.fullPath, name]);
};

/**
 * Return a URL that can be used to identify this entry.
 */
Entry.prototype.toURL = function() {
    // fullPath attribute contains the full URL
    return this.fullPath;
};

/**
 * Returns a URI that can be used to identify this entry.
 *
 * @param {DOMString} mimeType for a FileEntry, the mime type to be used to interpret the file, when loaded through this URI.
 * @return uri
 */
Entry.prototype.toURI = function(mimeType) {
    console.log("DEPRECATED: Update your code to use 'toURL'");
    // fullPath attribute contains the full URI
    return this.toURL();
};

/**
 * Remove a file or directory. It is an error to attempt to delete a
 * directory that is not empty. It is an error to attempt to delete a
 * root directory of a file system.
 *
 * @param successCallback {Function} called with no parameters
 * @param errorCallback {Function} called with a FileError
 */
Entry.prototype.remove = function(successCallback, errorCallback) {
    var fail = typeof errorCallback !== 'function' ? null : function(code) {
        errorCallback(new FileError(code));
    };
    exec(successCallback, fail, "File", "remove", [this.fullPath]);
};

/**
 * Look up the parent DirectoryEntry of this entry.
 *
 * @param successCallback {Function} called with the parent DirectoryEntry object
 * @param errorCallback {Function} called with a FileError
 */
Entry.prototype.getParent = function(successCallback, errorCallback) {
    var win = typeof successCallback !== 'function' ? null : function(result) {
        var DirectoryEntry = require('cordova/plugin/DirectoryEntry');
        var entry = new DirectoryEntry(result.name, result.fullPath);
        successCallback(entry);
    };
    var fail = typeof errorCallback !== 'function' ? null : function(code) {
        errorCallback(new FileError(code));
    };
    exec(win, fail, "File", "getParent", [this.fullPath]);
};

module.exports = Entry;
});

// file: lib/common/plugin/File.js
define("cordova/plugin/File", function(require, exports, module) {
/**
 * Constructor.
 * name {DOMString} name of the file, without path information
 * fullPath {DOMString} the full path of the file, including the name
 * type {DOMString} mime type
 * lastModifiedDate {Date} last modified date
 * size {Number} size of the file in bytes
 */

var File = function(name, fullPath, type, lastModifiedDate, size){
    this.name = name || '';
    this.fullPath = fullPath || null;
    this.type = type || null;
    this.lastModifiedDate = lastModifiedDate || null;
    this.size = size || 0;
};

module.exports = File;
});

// file: lib/common/plugin/FileEntry.js
define("cordova/plugin/FileEntry", function(require, exports, module) {
var utils = require('cordova/utils'),
    exec = require('cordova/exec'),
    Entry = require('cordova/plugin/Entry'),
    FileWriter = require('cordova/plugin/FileWriter'),
    File = require('cordova/plugin/File'),
    FileError = require('cordova/plugin/FileError');

/**
 * An interface representing a file on the file system.
 *
 * {boolean} isFile always true (readonly)
 * {boolean} isDirectory always false (readonly)
 * {DOMString} name of the file, excluding the path leading to it (readonly)
 * {DOMString} fullPath the absolute full path to the file (readonly)
 * {FileSystem} filesystem on which the file resides (readonly)
 */
var FileEntry = function(name, fullPath) {
     FileEntry.__super__.constructor.apply(this, [true, false, name, fullPath]);
};

utils.extend(FileEntry, Entry);

/**
 * Creates a new FileWriter associated with the file that this FileEntry represents.
 *
 * @param {Function} successCallback is called with the new FileWriter
 * @param {Function} errorCallback is called with a FileError
 */
FileEntry.prototype.createWriter = function(successCallback, errorCallback) {
    this.file(function(filePointer) {
        var writer = new FileWriter(filePointer);

        if (writer.fileName === null || writer.fileName === "") {
            if (typeof errorCallback === "function") {
                errorCallback(new FileError(FileError.INVALID_STATE_ERR));
            }
        } else {
            if (typeof successCallback === "function") {
                successCallback(writer);
            }
        }
    }, errorCallback);
};

/**
 * Returns a File that represents the current state of the file that this FileEntry represents.
 *
 * @param {Function} successCallback is called with the new File object
 * @param {Function} errorCallback is called with a FileError
 */
FileEntry.prototype.file = function(successCallback, errorCallback) {
    var win = typeof successCallback !== 'function' ? null : function(f) {
        var file = new File(f.name, f.fullPath, f.type, f.lastModifiedDate, f.size);
        successCallback(file);
    };
    var fail = typeof errorCallback !== 'function' ? null : function(code) {
        errorCallback(new FileError(code));
    };
    exec(win, fail, "File", "getFileMetadata", [this.fullPath]);
};


module.exports = FileEntry;
});

// file: lib/common/plugin/FileError.js
define("cordova/plugin/FileError", function(require, exports, module) {
/**
 * FileError
 */
function FileError(error) {
  this.code = error || null;
}

// File error codes
// Found in DOMException
FileError.NOT_FOUND_ERR = 1;
FileError.SECURITY_ERR = 2;
FileError.ABORT_ERR = 3;

// Added by File API specification
FileError.NOT_READABLE_ERR = 4;
FileError.ENCODING_ERR = 5;
FileError.NO_MODIFICATION_ALLOWED_ERR = 6;
FileError.INVALID_STATE_ERR = 7;
FileError.SYNTAX_ERR = 8;
FileError.INVALID_MODIFICATION_ERR = 9;
FileError.QUOTA_EXCEEDED_ERR = 10;
FileError.TYPE_MISMATCH_ERR = 11;
FileError.PATH_EXISTS_ERR = 12;

module.exports = FileError;
});

// file: lib/common/plugin/FileReader.js
define("cordova/plugin/FileReader", function(require, exports, module) {
var exec = require('cordova/exec'),
    FileError = require('cordova/plugin/FileError'),
    ProgressEvent = require('cordova/plugin/ProgressEvent');

/**
 * This class reads the mobile device file system.
 *
 * For Android:
 *      The root directory is the root of the file system.
 *      To read from the SD card, the file name is "sdcard/my_file.txt"
 * @constructor
 */
var FileReader = function() {
    this.fileName = "";

    this.readyState = 0; // FileReader.EMPTY

    // File data
    this.result = null;

    // Error
    this.error = null;

    // Event handlers
    this.onloadstart = null;    // When the read starts.
    this.onprogress = null;     // While reading (and decoding) file or fileBlob data, and reporting partial file data (progess.loaded/progress.total)
    this.onload = null;         // When the read has successfully completed.
    this.onerror = null;        // When the read has failed (see errors).
    this.onloadend = null;      // When the request has completed (either in success or failure).
    this.onabort = null;        // When the read has been aborted. For instance, by invoking the abort() method.
};

// States
FileReader.EMPTY = 0;
FileReader.LOADING = 1;
FileReader.DONE = 2;

/**
 * Abort reading file.
 */
FileReader.prototype.abort = function() {
    this.result = null;

    if (this.readyState == FileReader.DONE || this.readyState == FileReader.EMPTY) {
      return;
    }

    this.readyState = FileReader.DONE;

    // If abort callback
    if (typeof this.onabort === 'function') {
        this.onabort(new ProgressEvent('abort', {target:this}));
    }
    // If load end callback
    if (typeof this.onloadend === 'function') {
        this.onloadend(new ProgressEvent('loadend', {target:this}));
    }
};

/**
 * Read text file.
 *
 * @param file          {File} File object containing file properties
 * @param encoding      [Optional] (see http://www.iana.org/assignments/character-sets)
 */
FileReader.prototype.readAsText = function(file, encoding) {
    // Figure out pathing
    this.fileName = '';
    if (typeof file.fullPath === 'undefined') {
        this.fileName = file;
    } else {
        this.fileName = file.fullPath;
    }

    // Already loading something
    if (this.readyState == FileReader.LOADING) {
        throw new FileError(FileError.INVALID_STATE_ERR);
    }

    // LOADING state
    this.readyState = FileReader.LOADING;

    // If loadstart callback
    if (typeof this.onloadstart === "function") {
        this.onloadstart(new ProgressEvent("loadstart", {target:this}));
    }

    // Default encoding is UTF-8
    var enc = encoding ? encoding : "UTF-8";

    var me = this;

    // Read file
    exec(
        // Success callback
        function(r) {
            // If DONE (cancelled), then don't do anything
            if (me.readyState === FileReader.DONE) {
                return;
            }

            // Save result
            me.result = r;

            // If onload callback
            if (typeof me.onload === "function") {
                me.onload(new ProgressEvent("load", {target:me}));
            }

            // DONE state
            me.readyState = FileReader.DONE;

            // If onloadend callback
            if (typeof me.onloadend === "function") {
                me.onloadend(new ProgressEvent("loadend", {target:me}));
            }
        },
        // Error callback
        function(e) {
            // If DONE (cancelled), then don't do anything
            if (me.readyState === FileReader.DONE) {
                return;
            }

            // DONE state
            me.readyState = FileReader.DONE;

            // null result
            me.result = null;

            // Save error
            me.error = new FileError(e);

            // If onerror callback
            if (typeof me.onerror === "function") {
                me.onerror(new ProgressEvent("error", {target:me}));
            }

            // If onloadend callback
            if (typeof me.onloadend === "function") {
                me.onloadend(new ProgressEvent("loadend", {target:me}));
            }
        }, "File", "readAsText", [this.fileName, enc]);
};


/**
 * Read file and return data as a base64 encoded data url.
 * A data url is of the form:
 *      data:[<mediatype>][;base64],<data>
 *
 * @param file          {File} File object containing file properties
 */
FileReader.prototype.readAsDataURL = function(file) {
    this.fileName = "";
    if (typeof file.fullPath === "undefined") {
        this.fileName = file;
    } else {
        this.fileName = file.fullPath;
    }

    // Already loading something
    if (this.readyState == FileReader.LOADING) {
        throw new FileError(FileError.INVALID_STATE_ERR);
    }

    // LOADING state
    this.readyState = FileReader.LOADING;

    // If loadstart callback
    if (typeof this.onloadstart === "function") {
        this.onloadstart(new ProgressEvent("loadstart", {target:this}));
    }

    var me = this;

    // Read file
    exec(
        // Success callback
        function(r) {
            // If DONE (cancelled), then don't do anything
            if (me.readyState === FileReader.DONE) {
                return;
            }

            // DONE state
            me.readyState = FileReader.DONE;

            // Save result
            me.result = r;

            // If onload callback
            if (typeof me.onload === "function") {
                me.onload(new ProgressEvent("load", {target:me}));
            }

            // If onloadend callback
            if (typeof me.onloadend === "function") {
                me.onloadend(new ProgressEvent("loadend", {target:me}));
            }
        },
        // Error callback
        function(e) {
            // If DONE (cancelled), then don't do anything
            if (me.readyState === FileReader.DONE) {
                return;
            }

            // DONE state
            me.readyState = FileReader.DONE;

            me.result = null;

            // Save error
            me.error = new FileError(e);

            // If onerror callback
            if (typeof me.onerror === "function") {
                me.onerror(new ProgressEvent("error", {target:me}));
            }

            // If onloadend callback
            if (typeof me.onloadend === "function") {
                me.onloadend(new ProgressEvent("loadend", {target:me}));
            }
        }, "File", "readAsDataURL", [this.fileName]);
};

/**
 * Read file and return data as a binary data.
 *
 * @param file          {File} File object containing file properties
 */
FileReader.prototype.readAsBinaryString = function(file) {
    // TODO - Can't return binary data to browser.
    console.log('method "readAsBinaryString" is not supported at this time.');
};

/**
 * Read file and return data as a binary data.
 *
 * @param file          {File} File object containing file properties
 */
FileReader.prototype.readAsArrayBuffer = function(file) {
    // TODO - Can't return binary data to browser.
    console.log('This method is not supported at this time.');
};

module.exports = FileReader;
});

// file: lib/common/plugin/FileSystem.js
define("cordova/plugin/FileSystem", function(require, exports, module) {
var DirectoryEntry = require('cordova/plugin/DirectoryEntry');

/**
 * An interface representing a file system
 *
 * @constructor
 * {DOMString} name the unique name of the file system (readonly)
 * {DirectoryEntry} root directory of the file system (readonly)
 */
var FileSystem = function(name, root) {
    this.name = name || null;
    if (root) {
        console.log('root.name ' + name);
        console.log('root.root ' + root);
        this.root = new DirectoryEntry(root.name, root.fullPath);
    }
};

module.exports = FileSystem;
});

// file: lib/common/plugin/FileTransfer.js
define("cordova/plugin/FileTransfer", function(require, exports, module) {
var exec = require('cordova/exec');

/**
 * FileTransfer uploads a file to a remote server.
 * @constructor
 */
var FileTransfer = function() {};

/**
* Given an absolute file path, uploads a file on the device to a remote server
* using a multipart HTTP request.
* @param filePath {String}           Full path of the file on the device
* @param server {String}             URL of the server to receive the file
* @param successCallback (Function}  Callback to be invoked when upload has completed
* @param errorCallback {Function}    Callback to be invoked upon error
* @param options {FileUploadOptions} Optional parameters such as file name and mimetype
* @param trustAllHosts {Boolean} Optional trust all hosts (e.g. for self-signed certs), defaults to false
*/
FileTransfer.prototype.upload = function(filePath, server, successCallback, errorCallback, options, trustAllHosts) {
    // check for options
    var fileKey = null;
    var fileName = null;
    var mimeType = null;
    var params = null;
    var chunkedMode = true;
    if (options) {
        fileKey = options.fileKey;
        fileName = options.fileName;
        mimeType = options.mimeType;
        if (options.chunkedMode !== null || typeof options.chunkedMode != "undefined") {
            chunkedMode = options.chunkedMode;
        }
        if (options.params) {
            params = options.params;
        }
        else {
            params = {};
        }
    }

    exec(successCallback, errorCallback, 'FileTransfer', 'upload', [filePath, server, fileKey, fileName, mimeType, params, trustAllHosts, chunkedMode]);
};

/**
 * Downloads a file form a given URL and saves it to the specified directory.
 * @param source {String}          URL of the server to receive the file
 * @param target {String}         Full path of the file on the device
 * @param successCallback (Function}  Callback to be invoked when upload has completed
 * @param errorCallback {Function}    Callback to be invoked upon error
 */
FileTransfer.prototype.download = function(source, target, successCallback, errorCallback) {
    var win = function(result) {
        var entry = null;
        if (result.isDirectory) {
            entry = new (require('cordova/plugin/DirectoryEntry'))();
        }
        else if (result.isFile) {
            entry = new (require('cordova/plugin/FileEntry'))();
        }
        entry.isDirectory = result.isDirectory;
        entry.isFile = result.isFile;
        entry.name = result.name;
        entry.fullPath = result.fullPath;
        successCallback(entry);
    };
    exec(win, errorCallback, 'FileTransfer', 'download', [source, target]);
};

module.exports = FileTransfer;

});

// file: lib/common/plugin/FileTransferError.js
define("cordova/plugin/FileTransferError", function(require, exports, module) {
/**
 * FileTransferError
 * @constructor
 */
var FileTransferError = function(code) {
    this.code = code || null;
};

FileTransferError.FILE_NOT_FOUND_ERR = 1;
FileTransferError.INVALID_URL_ERR = 2;
FileTransferError.CONNECTION_ERR = 3;

module.exports = FileTransferError;
});

// file: lib/common/plugin/FileUploadOptions.js
define("cordova/plugin/FileUploadOptions", function(require, exports, module) {
/**
 * Options to customize the HTTP request used to upload files.
 * @constructor
 * @param fileKey {String}   Name of file request parameter.
 * @param fileName {String}  Filename to be used by the server. Defaults to image.jpg.
 * @param mimeType {String}  Mimetype of the uploaded file. Defaults to image/jpeg.
 * @param params {Object}    Object with key: value params to send to the server.
 */
var FileUploadOptions = function(fileKey, fileName, mimeType, params) {
    this.fileKey = fileKey || null;
    this.fileName = fileName || null;
    this.mimeType = mimeType || null;
    this.params = params || null;
};

module.exports = FileUploadOptions;
});

// file: lib/common/plugin/FileUploadResult.js
define("cordova/plugin/FileUploadResult", function(require, exports, module) {
/**
 * FileUploadResult
 * @constructor
 */
var FileUploadResult = function() {
    this.bytesSent = 0;
    this.responseCode = null;
    this.response = null;
};

module.exports = FileUploadResult;
});

// file: lib/common/plugin/FileWriter.js
define("cordova/plugin/FileWriter", function(require, exports, module) {
var exec = require('cordova/exec'),
    FileError = require('cordova/plugin/FileError'),
    ProgressEvent = require('cordova/plugin/ProgressEvent');

/**
 * This class writes to the mobile device file system.
 *
 * For Android:
 *      The root directory is the root of the file system.
 *      To write to the SD card, the file name is "sdcard/my_file.txt"
 *
 * @constructor
 * @param file {File} File object containing file properties
 * @param append if true write to the end of the file, otherwise overwrite the file
 */
var FileWriter = function(file) {
    this.fileName = "";
    this.length = 0;
    if (file) {
        this.fileName = file.fullPath || file;
        this.length = file.size || 0;
    }
    // default is to write at the beginning of the file
    this.position = 0;

    this.readyState = 0; // EMPTY

    this.result = null;

    // Error
    this.error = null;

    // Event handlers
    this.onwritestart = null;   // When writing starts
    this.onprogress = null;     // While writing the file, and reporting partial file data
    this.onwrite = null;        // When the write has successfully completed.
    this.onwriteend = null;     // When the request has completed (either in success or failure).
    this.onabort = null;        // When the write has been aborted. For instance, by invoking the abort() method.
    this.onerror = null;        // When the write has failed (see errors).
};

// States
FileWriter.INIT = 0;
FileWriter.WRITING = 1;
FileWriter.DONE = 2;

/**
 * Abort writing file.
 */
FileWriter.prototype.abort = function() {
    // check for invalid state
    if (this.readyState === FileWriter.DONE || this.readyState === FileWriter.INIT) {
        throw new FileError(FileError.INVALID_STATE_ERR);
    }

    // set error
    this.error = new FileError(FileError.ABORT_ERR);

    this.readyState = FileWriter.DONE;

    // If abort callback
    if (typeof this.onabort === "function") {
        this.onabort(new ProgressEvent("abort", {"target":this}));
    }

    // If write end callback
    if (typeof this.onwriteend === "function") {
        this.onwriteend(new ProgressEvent("writeend", {"target":this}));
    }
};

/**
 * Writes data to the file
 *
 * @param text to be written
 */
FileWriter.prototype.write = function(text) {
    // Throw an exception if we are already writing a file
    if (this.readyState === FileWriter.WRITING) {
        throw new FileError(FileError.INVALID_STATE_ERR);
    }

    // WRITING state
    this.readyState = FileWriter.WRITING;

    var me = this;

    // If onwritestart callback
    if (typeof me.onwritestart === "function") {
        me.onwritestart(new ProgressEvent("writestart", {"target":me}));
    }

    // Write file
    exec(
        // Success callback
        function(r) {
            // If DONE (cancelled), then don't do anything
            if (me.readyState === FileWriter.DONE) {
                return;
            }

            // position always increases by bytes written because file would be extended
            me.position += r;
            // The length of the file is now where we are done writing.

            me.length = me.position;

            // DONE state
            me.readyState = FileWriter.DONE;

            // If onwrite callback
            if (typeof me.onwrite === "function") {
                me.onwrite(new ProgressEvent("write", {"target":me}));
            }

            // If onwriteend callback
            if (typeof me.onwriteend === "function") {
                me.onwriteend(new ProgressEvent("writeend", {"target":me}));
            }
        },
        // Error callback
        function(e) {
            // If DONE (cancelled), then don't do anything
            if (me.readyState === FileWriter.DONE) {
                return;
            }

            // DONE state
            me.readyState = FileWriter.DONE;

            // Save error
            me.error = new FileError(e);

            // If onerror callback
            if (typeof me.onerror === "function") {
                me.onerror(new ProgressEvent("error", {"target":me}));
            }

            // If onwriteend callback
            if (typeof me.onwriteend === "function") {
                me.onwriteend(new ProgressEvent("writeend", {"target":me}));
            }
        }, "File", "write", [this.fileName, text, this.position]);
};

/**
 * Moves the file pointer to the location specified.
 *
 * If the offset is a negative number the position of the file
 * pointer is rewound.  If the offset is greater than the file
 * size the position is set to the end of the file.
 *
 * @param offset is the location to move the file pointer to.
 */
FileWriter.prototype.seek = function(offset) {
    // Throw an exception if we are already writing a file
    if (this.readyState === FileWriter.WRITING) {
        throw new FileError(FileError.INVALID_STATE_ERR);
    }

    if (!offset && offset !== 0) {
        return;
    }

    // See back from end of file.
    if (offset < 0) {
        this.position = Math.max(offset + this.length, 0);
    }
    // Offset is bigger then file size so set position
    // to the end of the file.
    else if (offset > this.length) {
        this.position = this.length;
    }
    // Offset is between 0 and file size so set the position
    // to start writing.
    else {
        this.position = offset;
    }
};

/**
 * Truncates the file to the size specified.
 *
 * @param size to chop the file at.
 */
FileWriter.prototype.truncate = function(size) {
    // Throw an exception if we are already writing a file
    if (this.readyState === FileWriter.WRITING) {
        throw new FileError(FileError.INVALID_STATE_ERR);
    }

    // WRITING state
    this.readyState = FileWriter.WRITING;

    var me = this;

    // If onwritestart callback
    if (typeof me.onwritestart === "function") {
        me.onwritestart(new ProgressEvent("writestart", {"target":this}));
    }

    // Write file
    exec(
        // Success callback
        function(r) {
            // If DONE (cancelled), then don't do anything
            if (me.readyState === FileWriter.DONE) {
                return;
            }

            // DONE state
            me.readyState = FileWriter.DONE;

            // Update the length of the file
            me.length = r;
            me.position = Math.min(me.position, r);

            // If onwrite callback
            if (typeof me.onwrite === "function") {
                me.onwrite(new ProgressEvent("write", {"target":me}));
            }

            // If onwriteend callback
            if (typeof me.onwriteend === "function") {
                me.onwriteend(new ProgressEvent("writeend", {"target":me}));
            }
        },
        // Error callback
        function(e) {
            // If DONE (cancelled), then don't do anything
            if (me.readyState === FileWriter.DONE) {
                return;
            }

            // DONE state
            me.readyState = FileWriter.DONE;

            // Save error
            me.error = new FileError(e);

            // If onerror callback
            if (typeof me.onerror === "function") {
                me.onerror(new ProgressEvent("error", {"target":me}));
            }

            // If onwriteend callback
            if (typeof me.onwriteend === "function") {
                me.onwriteend(new ProgressEvent("writeend", {"target":me}));
            }
        }, "File", "truncate", [this.fileName, size]);
};

module.exports = FileWriter;

});

// file: lib/common/plugin/Flags.js
define("cordova/plugin/Flags", function(require, exports, module) {
/**
 * Supplies arguments to methods that lookup or create files and directories.
 *
 * @param create
 *            {boolean} file or directory if it doesn't exist
 * @param exclusive
 *            {boolean} used with create; if true the command will fail if
 *            target path exists
 */
function Flags(create, exclusive) {
    this.create = create || false;
    this.exclusive = exclusive || false;
}

module.exports = Flags;
});

// file: lib/common/plugin/LocalFileSystem.js
define("cordova/plugin/LocalFileSystem", function(require, exports, module) {
var exec = require('cordova/exec');

/**
 * Represents a local file system.
 */
var LocalFileSystem = function() {

};

LocalFileSystem.TEMPORARY = 0; //temporary, with no guarantee of persistence
LocalFileSystem.PERSISTENT = 1; //persistent

module.exports = LocalFileSystem;
});

// file: lib/common/plugin/Media.js
define("cordova/plugin/Media", function(require, exports, module) {
var utils = require('cordova/utils'),
    exec = require('cordova/exec');

var mediaObjects = {};

/**
 * This class provides access to the device media, interfaces to both sound and video
 *
 * @constructor
 * @param src                   The file name or url to play
 * @param successCallback       The callback to be called when the file is done playing or recording.
 *                                  successCallback()
 * @param errorCallback         The callback to be called if there is an error.
 *                                  errorCallback(int errorCode) - OPTIONAL
 * @param statusCallback        The callback to be called when media status has changed.
 *                                  statusCallback(int statusCode) - OPTIONAL
 */
var Media = function(src, successCallback, errorCallback, statusCallback) {

    // successCallback optional
    if (successCallback && (typeof successCallback !== "function")) {
        console.log("Media Error: successCallback is not a function");
        return;
    }

    // errorCallback optional
    if (errorCallback && (typeof errorCallback !== "function")) {
        console.log("Media Error: errorCallback is not a function");
        return;
    }

    // statusCallback optional
    if (statusCallback && (typeof statusCallback !== "function")) {
        console.log("Media Error: statusCallback is not a function");
        return;
    }

    this.id = utils.createUUID();
    mediaObjects[this.id] = this;
    this.src = src;
    this.successCallback = successCallback;
    this.errorCallback = errorCallback;
    this.statusCallback = statusCallback;
    this._duration = -1;
    this._position = -1;
    exec(null, this.errorCallback, "Media", "create", [this.id, this.src]);
};

// Media messages
Media.MEDIA_STATE = 1;
Media.MEDIA_DURATION = 2;
Media.MEDIA_POSITION = 3;
Media.MEDIA_ERROR = 9;

// Media states
Media.MEDIA_NONE = 0;
Media.MEDIA_STARTING = 1;
Media.MEDIA_RUNNING = 2;
Media.MEDIA_PAUSED = 3;
Media.MEDIA_STOPPED = 4;
Media.MEDIA_MSG = ["None", "Starting", "Running", "Paused", "Stopped"];

// "static" function to return existing objs.
Media.get = function(id) {
    return mediaObjects[id];
};

/**
 * Start or resume playing audio file.
 */
Media.prototype.play = function(options) {
    exec(null, null, "Media", "startPlayingAudio", [this.id, this.src, options]);
};

/**
 * Stop playing audio file.
 */
Media.prototype.stop = function() {
    var me = this;
    exec(function() {
        me._position = 0;
        me.successCallback();
    }, this.errorCallback, "Media", "stopPlayingAudio", [this.id]);
};

/**
 * Seek or jump to a new time in the track..
 */
Media.prototype.seekTo = function(milliseconds) {
    var me = this;
    exec(function(p) {
        me._position = p;
    }, this.errorCallback, "Media", "seekToAudio", [this.id, milliseconds]);
};

/**
 * Pause playing audio file.
 */
Media.prototype.pause = function() {
    exec(null, this.errorCallback, "Media", "pausePlayingAudio", [this.id]);
};

/**
 * Get duration of an audio file.
 * The duration is only set for audio that is playing, paused or stopped.
 *
 * @return      duration or -1 if not known.
 */
Media.prototype.getDuration = function() {
    return this._duration;
};

/**
 * Get position of audio.
 */
Media.prototype.getCurrentPosition = function(success, fail) {
    var me = this;
    exec(function(p) {
        me._position = p;
        success(p);
    }, fail, "Media", "getCurrentPositionAudio", [this.id]);
};

/**
 * Start recording audio file.
 */
Media.prototype.startRecord = function() {
    exec(this.successCallback, this.errorCallback, "Media", "startRecordingAudio", [this.id, this.src]);
};

/**
 * Stop recording audio file.
 */
Media.prototype.stopRecord = function() {
    exec(this.successCallback, this.errorCallback, "Media", "stopRecordingAudio", [this.id]);
};

/**
 * Release the resources.
 */
Media.prototype.release = function() {
    exec(null, this.errorCallback, "Media", "release", [this.id]);
};

/**
 * Adjust the volume.
 */
Media.prototype.setVolume = function(volume) {
    exec(null, null, "Media", "setVolume", [this.id, volume]);
};

/**
 * Audio has status update.
 * PRIVATE
 *
 * @param id            The media object id (string)
 * @param status        The status code (int)
 * @param msg           The status message (string)
 */
Media.onStatus = function(id, msg, value) {
    var media = mediaObjects[id];
    // If state update
    if (msg === Media.MEDIA_STATE) {
        if (value === Media.MEDIA_STOPPED) {
            if (media.successCallback) {
                media.successCallback();
            }
        }
        if (media.statusCallback) {
            media.statusCallback(value);
        }
    }
    else if (msg === Media.MEDIA_DURATION) {
        media._duration = value;
    }
    else if (msg === Media.MEDIA_ERROR) {
        if (media.errorCallback) {
            // value should be a MediaError object when msg == MEDIA_ERROR
            media.errorCallback(value);
        }
    }
    else if (msg === Media.MEDIA_POSITION) {
        media._position = value;
    }
};

module.exports = Media;
});

// file: lib/common/plugin/MediaError.js
define("cordova/plugin/MediaError", function(require, exports, module) {
/**
 * This class contains information about any Media errors.
 * @constructor
 */
var MediaError = function(code, msg) {
    this.code = (code !== undefined ? code : null);
    this.message = msg || "";
};

MediaError.MEDIA_ERR_NONE_ACTIVE    = 0;
MediaError.MEDIA_ERR_ABORTED        = 1;
MediaError.MEDIA_ERR_NETWORK        = 2;
MediaError.MEDIA_ERR_DECODE         = 3;
MediaError.MEDIA_ERR_NONE_SUPPORTED = 4;

module.exports = MediaError;
});

// file: lib/common/plugin/MediaFile.js
define("cordova/plugin/MediaFile", function(require, exports, module) {
var utils = require('cordova/utils'),
    exec = require('cordova/exec'),
    File = require('cordova/plugin/File'),
    CaptureError = require('cordova/plugin/CaptureError');
/**
 * Represents a single file.
 *
 * name {DOMString} name of the file, without path information
 * fullPath {DOMString} the full path of the file, including the name
 * type {DOMString} mime type
 * lastModifiedDate {Date} last modified date
 * size {Number} size of the file in bytes
 */
var MediaFile = function(name, fullPath, type, lastModifiedDate, size){
    MediaFile.__super__.constructor.apply(this, arguments);
};

utils.extend(MediaFile, File);

/**
 * Request capture format data for a specific file and type
 *
 * @param {Function} successCB20b6fc3e371245927e00c7error041a
/
MediaFile.proto722c.getFormatData = f5927e00(f9745eb0allback, at :: e Apach) {
    if (722cof this.fullPath === "undefined" || one
 or more contrnulldation (ile
Software Foun(new CaptureEt ::(his work for.CAPTURE_INVALID_ARGUMENT));ion (} elseTICE file
 dxecsed to the Apache Software Foun, "his wor", "MT-0700 (PDT)", [one
 or more , one
 722c]right ow
};

// TODO: can we axe one
?
/*820b6Casts a PluginResult message property  (array of objects) to an the Licenn 12 2012nse at
 20b6(used in Oe at
ive-Cmmit Android)e5820b6fc3e3712ense.  You m} pnse.  You mue Jun 12 2012 cast

/*
 Licensn writing,
 dation (var m 12 2012s = []ight ofor (ed oi=0; i<n writing,
 .y obtai.length; i++OTICE file
 ed on an
 "AS = th tn 12 2012(right ohe
 n an
 "AS.nam.  SES OR CONDITIONS OF [i]anguafor the
 specific laor more co governing permissions anor more for the
 specific la722c.
*/

;(function() {

// fi722cfor the
 specific lalastModifiedDatrequire,
    define;

(funct = {};

    funcfor the
 specific lasizrequire,
    define;

(funct    for the
 specific ls.push(n an
 "ASy not usehe
 ES OR CONDITIONS OF  =on an
 "AS ight oreturnodule.exports;e thimodule.export IS"n 12 2012;

})this f/ co: lib/common/n writ/n 12 2012PDT).js
tor li("cordova{
            throw "",/*
 Licensrequire, e = fun,  requidatie
 with      throw " encapsulates WITmat inrts;
 ionicenaspeciff (!m.e5820b6fc3e3712DOMString} codecses/Lfc3e3712lo  ifbitratce58[id]) {
       heigh sof[id]) {
       widthlready definfloat} dur    due Jued oles[id]) : mod
/*
 Licens (modu,      th,d + " a,      ,es[id] = )tion (one
  (modu =f (modunse he Night oone
      th =      thnse 0     delete + " a =d + " a };

})();

//Ex      =       };

})();

//Exs[id] =  =es[id] =  };

})
    require = function (id) {PDT);       if (!modules[id]) {
        tadw "module " + id + " not found";fine;
        return modules[id].factory ? build(moduI };

    deabout the st    er one// comor directorye5820b6{func}ctorific    dTime (readonly app        fine;
            tim? bui   deletetentLoaded and no=F) under od no!= 'butor lic'?th tfuncment.a:he NO) {
    module.exports.refine;
uire;
    module.exports.define = Posi   dmodule " + id + " not foundment.rea        return modules[id].factory ? buied oCoordin.expo= rn modu('d + " not foundtercept cal'    ed oment.rea            faords,nctiostampdation (ASF),
 * rOTICE file
 remove  * r  See ttercept cals.
 */
.latitude, .addEvenongistener;
var malListener;
var maccuracyer;
var mheadinger;
var mvelocitemoveEvententListeAment.reright ownership.  The ASnt_addEventListener = documenty(require, mo"); yome, and oadedstener;

!== butor lic) ?sume, and  :See tDOMCod.fire();
}, false);
if ment.rea
        if (!modules[id]) {
      ment.reanal inyState == 'interactive') {
    chak for        return modules[id].factory ? build(modud handle at ::nse at
e5820b6fconstru* Lilready defi (molready defiy obtaihannel sument.addEvent            fact,[e] != 'dation (remove = nction d) {
        delete module);
  obtain|| '') {
   {},
    windoPERMISSION_DENIED = 1;  } else {
     OSIT docUNAVAILABLE = 2Handlers[e].subsTIMEOUT = 3ument + window event listenek fort.readyState == 'complete' || documrogressEventowEventHandlers = {};

docum
};

window.        return modules[id].factory ? buil/ If (evt, handler exihe Lin global context, use it alify y, otherwise'undeour own polyfille();Fea wor test: See(ASFwexceptinstanti    a naUnle   if (typeof ;e();if so 'undethat approach,e();      winde].s-in withventHandlimplement    d.
//e();NOTE: re in nowt in lways};

dventent.removeEv. Dandlhannroad would be nic   } else {
undewhatever isdow_addEie();
 webview.er and if (typeof w= (*
 Licensdation (/*ributed ocreateocumentE*
 Licensne;
ither express orecumentEdocutene.") {
      ('ndow.isten the
 sbscrib.initelse {
typeof docume', falseent, ev m_documentASF)entHandlers[e].uIS, WITHOUT WA by     }
};

window.rempture);
    .hasOwnPa copy (i) function(evt, handlment_remo[i]e(haata[iBASIS,  an event thre, movent that is handled ber, captutargedistributtHandlers[e]s file excepnot call <some_custom_se at
>.dispatchndow.EventHandlers[e] != need    first fig(hanequihow    ntListene ndow.Tf win;

window.remt is handlt is handlodule.escribight ow     deryndlers[e].unsubscncti   } else {{722c:"abort",of win:andler);    re);
    }
};

*
 Licen(typeof docume) und,ner = function(evt, h(typeor requion () {
    v
    }
};

r event = doentHa   event.ieateEve} ce].u(edefine.*/  event.initEvent(type, false, false);
    if icndowEventHandlers"); you min data) {
          elete ubbAS IS"t, evole === "undefined"cancelB {
   window.console = {
        log:fation(){}
    };
}

var cordovaNY
 KIComput   define:define,
    require:reoadede(haict &&wn adve your ?entListener h:

})();
}

if(typeof wotal own addEventLis*/
   ijackin*/
   cument + window.
     *f win  addWindowEventHturn (r:functiturn (:{
        d{
         //}
})n doent + window event entListener.ca      if (!modules[id]) {
      accelerometedowEventHandlers = {};

docudocumentEvent        return modules[id].factory ? build(moduThis classn a vides docuss    devribidocumentEventor (vae();
    if (typeof      utillls to addEvid + " nontEve"),  eveF lintHandler:function(eF li {
     Aocumenequire =to addEventListener + ret];
    },
 stene();
s();
 docum sensor running?er any Cordo window.coers Keeps reference    we].ut];
    },
  {
  s  if (
 * rtLis{ this fAhe Licenlisteners;n evlse {keep trackva/cwhept inshIf un{
   startmmit stop  if (nt': {'adIS" BASers Lutedodule.edEventHan    defe at
 fromdow_adder anre rep the Nthis fiell handled tor, 're.
t(type, f, 'reers[e] !=F lic*
 LicensHandlers[e].unsubtempLr': m_documnt': {'ad.slice(0ty(i)) {
  ener': m_ewnt];
    },
 (a.x, a.ycumezcumeume, and p   event.ioveEventLis= 0, ': m
    /**
    ANY
 KIND, < lND, either expresndefi    /**
    s anwin(documty(i)) {
                retu') {
    ;
    },
    /**
     * Method to fire event from na{
        var evt = createEvent(type, data);
        if (typeof documentEventHandlersfail(dler, captur') {
    "t];
   vent, opt", 're 2.0ay not u  *
     *true;
}ow_addEventListener, 'rntLiEventListenop: m_window_remhe N,{
   vt = createEvent(type,opa);
        if (typeofndow.cowEventAdd Lic{
  pach pairer, hanner': m_docthe Ldefined') r evenare FounPair(winent,iNOTICE fiodule.e{win:think abo: abo} window.Remov     win/ abo }
    },vt);
 : {'a    }
    },
    // TODO: thirlse,
 /**
    (NOTICE fiUT WAdx * Method to indexOf(= 'undefASF)urre> -1cumentEventHMethod to fpire eidx, 1ler, capture);
Method to NY
 KIcontr0dowEventHandlers{
    ) {
        var ewindListener'andlers[e=s[e] != ""undef * Asynchronously a moduhat wecurrister},
        .// queu// queuefc3e371245927e00c7f9745eb0Event(ev   Tanne(type, ftostenerent_at were re       'ibersis avai    d  // END TODO
    /**
    Software FounEventHmechanism.
     */
    callbareacks: = evt.tgett    lbackId: 0,
    callb. (OPe(haAL)  // END TODO
  t];
    },
 Op   ds} oTION:      
       WITHN: 2,
        ILLEGdlers[event7f97h as) {
 outEXCEPTION: 3,
      data[getCmandQut];
    },
 :/*
 Licensed to the Apache Software Foun,LFORMED_cumentEventH//  * Plugin callbarn modudr, capture);
 under  * Plugin callba cus"anism.
 " event;
}

if(typerowicensSON_EXCEPTION: 8,
  mustnsub{
  ede = evat leutedTION: delehEvent(evanism.
  a
       c3e37ventH") {
        er express orp   event.ied owie deviceready }
};

window.rem * Plugin callb(rty(i)) {
  ow to   // This queutype, data) eateEveo be senollin documentEvocumentEventHle
 distributed widler, capturkStatus.OK) {
                try {  event.i

/*s is Android only; think abou   event.iMethod to      typer, capture);
!y Cordo Indicates if we'rer': ) {
        var ev     }   // queue on the native side.
    cokId: 0,
    crep {
 dve srgs)give{
  tervalalse,
    // END TODO
    /**
     * Plugin callback mechanism.
     */
  eachnctionlbackId: 0,
    callbacks:  {},
    callbackStatus: {
        NO_RESULT: 0,
        OK: 1,
        CLASS_NOT_FOUND_EXCEPTION: 2,
        ILLEGAL_ACCESS_EXCEPTION: 3,
        INSTANTIATION_EXCEPTION: 4,
        MALFORMED_URL_EXCEPTION: 5,
        IO_EXCEPTION: 6,
        INVALID_ACTION: 7,
 @odule.e      toLowerCase();
    ack mechtOrig idt, haness: funpasentList#clearW]) {
] != 'uId]) {ingalse,
   data[tOriginalHandlers       ERROR: 9
    },

    /**
     * Called by native code whenDefau ma      }
 (10 sec3,
            rn mencyntEv
       &&LFORMED_.  catch (e&& datacens     console.log(== 'number' hanerror callback: "+: 10000      }
   hen returning successful result from an action.
     *
     * @param callbackId
     * @param args
 tOriginalHandlers:ess: function(callbackId, args) {
        if (cordova.callbacks[callbackId]) {

            // If  object     */
    getOrig id,mmit re= fuative cify ingsllbaofteallbator lic by   catch ( is to be senir owntEve
    } UUID
      // If resulId].success(args.messaentHandler{           documentEventHs[callbackId].success) {
                        cordova.callba                }
                }
    {
   [idnsubvent;
}

if(typ{
  ettedow.setI     }
ventHandlers[e] !=a plugin
    if e] != evt.toLowerCase();
    gs.status == cord] != 'undefinedvent that is handled by, and windo{
                  }
  :pova.callbacks[callbacASF)        catch (e) {
   ();
  we'rture') {
 if (typetnt_aimn an
tely invokargs.k {
        if (c       if (args.status == cord] != 'undefined'nership.  The AS
                    co  event.initEvenidight ow.log("Error in sucC    hat wespec
    EventHandlers[etOrigalse,
    // END TODO
        ifids[callbackIidva/chann      ntListene: {'a#tOriginalHandlerss[callbackId].       if        ERROidative code whenSova.javascriptdConst &atus.OK// END unctint':to run constrid("Err
        bscribeOnce(funcuctor:      ction(fun   var logfunctrss) {
                        c       if (nt': {'ad              fdelete    var logrrently in the midd   addDocumentEventHdocumentEvent
        if (!modulesared byhannel.cr       appHandlers[event] = channel.cr     var fnnel.onDOMContentLoaded.fire();
}

/**
 * In   delete documentListenF listene require = functidEve   // qntEvent();
  esourcunctchn (ilbackId     CECAT:entHandlers[e] != windowEventHandler     "] The "' +a);
      cordov         L  //hannurvar        ugin
  ;

/     e
  browst is     cTION NO      fc3e371;
         }
 mechURL(core yo              a cs       }
    vari
    a) {
ntry {
     by a      a Unlity:          foait:    cordova.callbacks[callb   n=>      msec before     f (cURL })(i);
   prop) {Dialog: "Title,M(handl"    newObers[layindow_addEprop) { d);
  urn obj[prop]; Urlnd noutValue     } else {
   =>nctionin = (fu getOi: fution(triggeif (ca           NO_ })(i);
        His Lis: boolean            newOb              hctions (d      = handl })(i);
   openExternal(cordova, 'PhoneGap');
}
icate2.0.a  logHash[fun    window.Cordova =      ExatLis  })(i);
   navigator.r fuable fo("http://server/myapp/ng co.html", {     200 evt]; })(i);
   "Wait,rdovf (cd in vable for plugin suppo6    Error: ackIdable fo objLabel url,nk.app+ '" global will be removed in veable fo 2.0 {
var utiase use lowercase "coClog:f, export
     is (!wi};

/onsube yourION NOTICE]log:frdovorts, module)+ '" global will be removed in vernProperty(pr please use lowercase "co  conswebrdova) {
by a jecteb n
         InsteaereadBACK buttonObj;
}

/hannpreviou, objepage,efinw  vaexiuire('r fuON NOTICE] Thenctions(objLabel + '" global will be removed in versionnctions please use lowercase "coGo    ion (obj,) {
 }
    robjects.nctioniHandlerguagant) esss, functpacheach(obonuired by window  var resupachobj.path ? require(obj.path) : {};

          if ( result;
   please use lowercase "coOverridargs.k   wind behavit.to/chann        LT: 0each(o clobberf of mergden,   callbacerwise, clopeof === edse")e= 'undKeyCase" JavaSrecatescribe   trb
};
robjects.clobbeNote:     u[funventLisd") haener, {
   ent, method. er, merg    if (mer     })(i);
    regt': r_URL_E    recureach(o"y], rese"); acks:uto
   {
  y dontrue;
                     e    }
   = not cur, F=ects[pf not curON NOTICE not curBt = parenh ? requir not cur+ '" global will be removed in vekey] == 'undefined 2.0 not curase use lowercase "coE {
 mit 7ermpt ca        loaded a  var resuy {
Apph ? require(obj.pa }
};

fal will be removed in veent ont please usetiondFunk = obj[prop];
                    vahEvent(eunkId = objLabel + '_' + prop;
    hEvent(ennel.onDOMContentLoaded.fire();
}

/**
 * Inlog(" the N
     tokee de.
        d + " n   /**
     * Retre'{
     poll     *to addEventListener + re
        

            hEvent(ev documentEvbscribeOnc//ed') {windhu 2,
  dandlap.log("Faents.
+ " n.    }
  CasebscribeOnce(fuodule.   eventuse');
ch();
  }

     flag was chang    , 'remu 'und+ e + ' f {'adow = {
handler,         UseP

    bscribeOnce(fu   incl            building cordova JS globaed oxmls =   See tXMLHttpRcatcs     S globals:in callbaanism.
  ent_aerwrite existipeof') {

 * Merobject .on') {
cordo' + ke=ame]) {
   ursively.  if(into.
 *') {
Sordovontr4){se');
chanr, merge);
          }
        } catch(e)o run constr         utils.alert('Exception buively.  Properties frodler('pause');
chan globals: ' hEvent(evhase(parent[keycordoListetoecursuthronnel.onCordovaReainto.
 *cordusrsive20/ Indt.toLowerCase();
  on(e else {;
  dementEole.logpons           // Ifibuted ons   *      URI,
  one);

 */
functarget.Text              func(  setr pluginc) {
        channel.onCordovf documt(type, data)     target[prop],  },
 = e(funmsgrget[prop] = typeof s that is handled b    return      rdova.callbacks[cantHandlers[e] !=  }
      N: 2,
  _EXCEPTIOOT_F, sees, functe(handle   trhelpsteneebuggin Legaon (target) {
             oles og("JSin callb:  }
      });
S}

mo: " +prop[prop];
            }
             include(target, o k for: "+ess) {
              }
        }
    }
    ret}dova.exec().
 = typeof src[prop] ==hEvent(e
            },
    == 'undefined' && target.prototypf (cICENSEistener'XHR    io meobjLabelf (cout  }
      [name] rshi the target object is a404bscribeOnce(function()    intoAndMerge: funcvent from na) {
                include(tsecurityPhoneGap =*
 * Custom file: lib/common/channel.js
d3bscribeOnce(function()obber: function(target) {
     Inval        . unctijectshEvent(es."orts, module) {
var utils = require('cordo

mopeof);
 ject
/**
 * Custom pub-sub "channel" that can h5ve functions subscribed to it
 * This object is false) Closed:trol firing of events for
 * cordova initialization.
 *
 * Th        wasn't GET
/**
 * Custom pub-sub "channel" that can hav/ Indicates if weoAndClobber: function(target) {
     Baole.     ontrol firing of events for
 * cordova initialization.
 *
 * That ::, rhat et) {   incl
/**
 * Custom pub-sunctions subscribed to it
 * This object is used toct to me aboedts for
 * cordova i parent[keyes from oneeof windoon (target) {
    nother recursively.   that is handledt is hanacks[callbASF)y exise the NOTICE file
 n seexistprompt(censPeateE "gap_hEvent(efalse);s for
 * ct is hanASF)      rhat Cordova is ready
      resume       T            User event fired to indicate a stinto.
 * pen("GET    s = {};127.0.0.1:"+ * o+"/"+resume,f win          target oendn document + window eventhEvent(e    parent[key] = result;
            } els   parenkId = objLabel + '_' + prop;
    windownnel.onDOMContentLoaded.fire();
}

/**
 * In' + nr': mto addEventListenrdova n        ntEventHandler:fentListenntEve                     if (!logHash[funkId]ler:functionre ===          obed. windowconsol) {
      a copys);
WITHinr('r2,
      model, version, ersionto palreaphonulestc];
    },
    removeDoanism.
  Dindowlobber, mone
 :  {},
   window.consolone
 platrts;: m_windofalse);
 Listeneocument.addEventLinguage 
        deleteuul be 
        deleteent[key];
_windowibuted on eof his", myPardova n.onC      R) {
.subprecbeOncenc) {
        channel.m GMT-ar cname]) {
   };bscribeOnce(funcmeeviceReadyLisction property hasme *      docu  }; *      dunload
 *
 */

/*stener("rel
 * Listeneunload
 *
 */

/*nguage l
 * d limitations
 */

/*    docl
 *     unload
 *
 */

/*ent[key];
l
 *        n property has
 *
 * The DOM liar cfecycl                c,  if (cordova.callbacks[cad
 *      windondow.console = {
  removealert("[ERROR] {
    eEveializ con DOM li;
    ta) {
       right owd.fipp has moGet windowE  };e5820b6fc3e371245927e00c7f9745eb0Event(evmechanism.
     */
    callbacListenecallbacks:  {},
    backStatus: {
        NO_RESULT: 0     OK: 1,
        CLASS_NOT_FOUND_EXCEPTION: 2,
      the Channel.EXCEPTION: 3,
*/
("devi 11:04:57 GMT-ar c

/*
 Licensed to the Apache Software Foundatis));
  n returning successful result  an action.
     *
     * @param callbackId
     * @p      include("devi {
                     s haorgs) callbackI   event.initEve not usefalse;
   NO_RESULT: 0error alion (ASF)  NO_RESULT: 0&&n action.  NO_RESULT: 0param callbackI        onUnsubscribe:null
    };
    i  NO_RESULT: 0   if (opts.onSubscribe) this.events.onSubscribe = ubscallbac ASF licenses this file
 to you under the("devi Licens("deviar ca);
     this820b6DEPRECATED:functionis our turneired by (id, faYou.callbex meritlyf not curr(merge) {
     ];
 ers = {};
    this.key] == 'undBach(obhildren, clobber, msubscribe:null
     (!(--i)) h();
    ()var d bacc    .  Uses
de (!(--i)) h()each(o( firets for
 *ns) {
    windubscribeOnce(f):i--;
   function (h, c) {
            var i = c.length;
          ved to seound
 *ge) {
      
      erge propertiesumoveDos = {};
    this.e] =  h();
            };
            for (var j=0; j<l   },

                 !c[j].fired?c[j].subscribeOnce(f):i-- handl         }
            if (!i) h();
       handler      create: function (type, opts) {
            channel[typ         hat were      ! {
                if ent ont        };
            for (var j=0; j<lent ont         !c[j].fired?c[j].sady" even         }
            ady" even) {
    module.exports.ercep"device    parent[key] = result;
            } elsnottLoaded ardova events that user code should    The uniqu             return function() {
                        if (!logHash[funkId]e) {
    {
             enh = t     tLoaded a API) {
  ) {
                 nati      S 'rem       ERROt     ceready') {
    lobals: ' }
   {
   e(handleif (r('resume'// Remimicrent, otheerties ontPlugin: func
     erge pros     salse,
 n (ASF) under o     ontributor licen"Error in  module);tributor lice event;
}

if(typ       "Busy {

             odule);
'Pd, a);

it...'andler('pause');
chancursiveMerge(resu'Ns[feature])', 'eature];
    ', [                ay not usordova.addDocumentEvos    feature];/**
 * LegalbackId].eature];
 o intc) {
        channel.leted and the feature is ready to be used.
 op    aram feature {String}     TD
    retup
};

wi/**
 * e = ev(c) {
   bonsolat goretu {'a0 opt100Ready = cordova.addDocumentEven// queue       }
             onto par(c) {
         alse,
   forceFunction(f) {
    if (f === n   * Indects, fate w
    reby a plpeof f != 'fun data[(c) {
  
                }
                else {
 leted and the feature is ready to tion to the c     *
         * @param feature {String}     The unidefined || typeof f != 'funn function to thializationComplete: function(feature) {
            var c = p subscribineadyChannelsMap[feature];
     Seuire('(c) {
          v supalse,
    // END TODO
  NackIdf) {
    if (f === n   fo 0-100he given function to n suplizationComp   fohannel.fire is called so too will the function.
 * Optn sup     c == "ay not use thdFunk = obj[prop];
                    va   inclrdova events that user code should    incler for are:
 *      deviceready           Cornt[key];
            }
          }erior ow50      }

       ldren, clobber, merge);
          }
        } catch(e) {
          utils.alert('Exception building cordova JS globals: ' + e + ' for key "' + key + 'op;
        }
    });
}

/**moveEvwiif (cor
   e order/eready channels      roperties from one object onto a   if (obj.children) {
         hEvent(e',
   rsively.  Properties from
 * the src rop];
sume               ied to indicASF)     fired when drc[prop] === 'object' ? recursiveMerge                  targetsrc[prop]) : ""+        },
              }
    }
   target;
}

module.exports = {
      include(target, orom onebjects, false, false);
            },
            iis.fired) {
        if (typeof {
                include(t          Use
            },
rc[prop] ==   incldova.exec().t is han cordova.addDocumurn g;
};

/**
 * Und = g;ubscribes tion(prop){
             incle've seen this subscriber
        g = this.tionOF AnkId = objLabel + '_' + prop;
    scribe
nnel.onDOMContentLoaded.fire();
}

/**
 * Inva APIs can be called from JavaScript
 *      pause                 e(resuldova native code is initialized andener anqueryQueu  },  retu
 withSQLpe] ReadyettoLowerCas PRIVATE METHO       },
    removeDocumeDd byDB_Row  windren, clobber, mone
 ler.obeed S" BAoff proler.ob
    // require:requirevar ;
   );
    }ackIdontoash[ap: {},onUnsubscitemalse, fandler.observe5820b6fc3e371rgs
      }
      rgs
.onUnsutouilding     odule.e.
 */
ChannelunctionsoLowerCas/
handlers[g]  11:04:57 GUnsub null;
    row             rete this.handle[row]Map: {}, if (handler.observein objecntListenee.
 ser];
  ndler.observer_guid=null;
        this.handlers[er.obs null;
        delete thig] = nercepandlers[g] initCompe
 with tty.
 *
  {'addEvenumentEent_a (hanvar cotListn (id           var han           HandlQ)===faddEventListenere);
         (  coentHandlers[  if (han =f (handler)    newObjASF) (hanvar m_documen                 
      rn !fail;
    }
 e);
           ubsctranseatu**
 * MerEventHandlerent (han.txer fast!
// DOM ev    hat is recype.    nectio e);
            else We ignion(
       re  this.nifdoesn't ex (han e);
           p[featuallbacent[kel.create('onection a plugin
    if txevicex. (han /** logHashEventHandlers[e] != S   prdova native  property has bee
    nction') {
     er.ob onDeviceReady      r= 'fuhis.handlers[ument.');

// Event to indica       ifne;
}NY
 KINoperties are avai                  target[pASF) under e is l                 lif'ull;
   'bscribeOnce(function() {ionRion property has beenurn tr.tx, hasOwnProperty(i   }
        }
    }
    r        (exbscribeOnce(function() {      include
      Sql= evt.t{
  );
       {
        if (c     x              func();ovaInfoReady');

/pt obje,
      a medovaInfoReady'ndler, captsubscribe(g);
    };
    esume lifecycle event
channel             inc the middlevar rv = (handler.apply(this, arguments)===f aboses/L       fail = fail || rv;
  reasol.
 */
Channe      e] != 'und| rv;
       y');
channel.     }
        }
      abofireArannel.,  message o        return !fail;
    }
    return true;
};

// defining them here so they are ready super fast!
// DOM event that is received when the web page is loaded and parsed.
channel.create('onDOMContentLoaded');

// Event to indicate the Cordova native side is ready.
channel.create('onNativeReady');

// Event to indicate that all Cordova JavaScript objects have beele event
channel.create( /** {
     vaInfoReady');

// Event to indicate that the connection pr  NO_RESULT: 0set.
channel.create('onCordovaConnectionReady');distributed widicate thatnnel. Cordova is ready
channel.create('onDeviceReady');

// Event to indicate a resume lifecycle event
channel.create('onResannel.creavent to indicate a pause lifecycle event
channel.create(Fectiorgs =             }
      cycle eventdestroy lifecycle event
channel.create('onDestroy');

// Channels that must fire before "e.ca    rer_guid) handler.observer_gue();
    if (typeof documentxady');
channel.wmechel.create('owindow'     ent,     rebe_doclete    this.handlers     }.
 */
docume
// Efalse;
 eed a fuceready');.
channel.one
 l be removed in version 2.0.")ow.dis
           
      qler)     rn !fail;
        nsuber, false);
chaniventg,
 soelete this.handlers[g];      path: 'cl.create('oter'
                },
    (typeof wrentoaded andcamera:{
             l.create('o
    var        t objects hugin/Camera'
            = (handlgin coone
 operty has been scument.addEventL      children:pause",     var rv T/plugin/accelerom) handler.observer_guid=null;
        this.handlersTrentull;
             path: 'cordova/pluginthat is received                },
                cam   },
                device:{
                    children:{
                         }       path: 'logger'
            var rv Markts)===fan             y "');
         Ifhe Cordovs);
aris, nPause,ent[key] }
   's             ume');

// Event (id, factory) Handler('channel.waitForInitialcapture'
  11:04:57 Geate('onPause             message o
       : {
          super fast
channno mion(out    er.js            n     plugin/network'
    ion (ASF)        device:{
   ither express orcoumentEment + wind wille {
           istenh: 'cordova/plbscribeOnce(funcon: {
   logger'
 ure) {
    var e = evt.toLowerCase();
Accel++
// Event to indicate a dto run constrAcceler  // Indicates if we                  targ{
            path:  onDeviceReady         eve CameraPopoverOptions    includecapture: {
 annel.create('onResume');

// Event toChannel.
 *    , handler, capture);se thishildren: {
                        icate thail || rv;
       ');
channel.waitForInitidy');
channel.waitForInitialization('onCor       },
                sp      en: {
        avigator:          }mechsq          parent, el.create('onDv    });
  been if , sincpath: // elsre
       '      pa      path: 'cordontListene    };ly(this, arthat a// Howhat            g of even      resremai
    ading:{
        hat is received },
  vaif (function(that ah: 'cordova/pl            on: {
   Software Foundation (  },
        CaptureEr path: 'cordova/plConnectnel.onPause =aptureError'
        },     CaptureAudioOptions:{
            path:  path: 'cordova/Channel.
 *             CaptureImaE      '
   === targeova/plugin/Capadinpath: 'cordova/plu  ContactErrot) {
           oldFunk3e37ply(obj, ava/plugi== targetllbackId]ules[id]) {
 * Plugin callback lugi deviceready chan
          NO_RESULT: 0,
   itializat ContactFin       },
             le event
ch
/*
 Licenseq
varConta,ontactField'
   ;
    this.fired = false;
     } ContacumHandlersASF) under  Contacset.

    channrror'
      ation: {" BASIS, bscribe = C) {
        mit ara:{o     path:         retuion') {
    fireAr{
  

// Evrn !fail;
 dicateCamera (han           a/plg of even/Coordinat    device:{
                     n/Coordinatchildren:{
      Software Founocation: {
   gin/CompassE      windowEventHandleSd) { throcle event
c 2.0Name: {
           },
nitComphis.hatabaseShel      Contact           if (h 'remoova/plugin/C];
  D    his.cup * onro/**
    

functonto abourn (id, factory) pro dele245927e00c7  path: 'cordova/plugin/accull;
   a/plugin/ContactField'
    245927e00cFindOptions: {
          cordova/plugi/
in/Entry'
    11:04:57 G             under the L: 'cor  /**
     * Call         path: 'cordovae web pagion') {
    Tx        tx: 'cordova/plugin/DirectoryEntry'
      tx        DirectoryReader: {
       },
        CaptuReader'                 t;
}

module.ex     CaptureAudioOptions:{
                incva Javh: 'cordova/plugin/Connect  },
        CaptureError: 
        },
   cess) {
         eReady');

// Event to indicate       },
        ContactAddress: {
            path: 'cordov          include        },
        CaptureImaO**
 cribntryova/plugin/CapnguageWriter'
    in/Entryn/FilFindOptionsstener("ter'
        },
   ListeneFindOptions}

/**
_/FileWrite   },
   }

/**
      Flags: {
     mWriter'
        },
       min byteules[ihannel.
 */
Channel.LocalFileSyste.fire = fuhis.handlersvent   },
              ngua* Listeners   },
      ing'z  parent[key] = result;
          },
 '
        }, 2.0iaError: {
            path: 'coray not ued odbpath: 'cn/Entry'
           odule.edb      childreForgHash[fuse = evn    cal        elsemd].ex      thgin/ite. Follg] =     3c api];
  ile exDo simil    or s== 'on       ];
    },
    removeDocumeCupcakeLdiaFileData'       };
           *
 * T iniFor        c   fir"c     p       }g targetefinin       typeof'
  '
        },('ediaFileData to 1.0 to  },
        Pro262144vent from ed oscribe
 {
      require:requireeration'
   EventListeetL  },
 (NY
 KIvar m_document_ad   },
   'onCordovaInfoReediaFileData/plugin/requestFileSystea/pluginn/Positth: 'cordova( {
       (type, f(va/plugin/Crror'
        },   },
        C 'coath: 'cordle event
c('CREr.obT     IF(evt EXISTSlugin/Pro= {}NVARCHAR(40)izatMARY KEY, bodyction(requ255))  m_document};

});

// file: lib/andrSELECT patROMlugin/PreadyC       retu
     is distribut{
               var ta);
 nchronable
channel      if (typeof docuwe'reibe
[de can returUnsu(i) },
   ide can returJSON strule)lt'
        },
        Fof src[m:{
  (de can return:
 * 

// Event to i       }        c    d'onPause'r: {
            paeady
channe       }
   }
         a/plugin/rerrrror'
        nel. Sets
 *errubscribe           consol  result of{
    etI.enabled) {
   key,   /rror'
      ASF) under(nResult key])==          path: 'cordovordova/plugin
           a/plugin/Cf the servic =   /esult of tI:{
            path: 'cordovova/plugin/resolveLocalFileSystemURI'
 

});

// file: lib/android/exec.js
define("cordova/exec", function(require, exports, module) {
/**
 * Execute a cordova cordova = require('cordova'REPLACE INTOa/exec", funodule))   // s(?,?)    Strivalay not uions'
        },ubscribes sEvent'
     numHack
 * @param {Strrror'
      odule.ef the servicess:success, fail:failtus.OK    }

    var r = prompt(JSON.
      fy(args), "gap:"+JSOordova/plugin--{String[]} [args]     Zero or more arguments to pass to the method
 */
var cordova = require('cordova');

module.exports = function(success, fail, service, action, args) {
  try {
    var callbackId = service + cordova.callbacDELETEside whether gume_FOUd=?ordova.backs[callbackId] = {success:success, fail:failf (!wid = g;
    this.handln cordovaogressEvent'
ordova/plugin/rement + wind0) {
        var v;
        eval("v="+r+";");

        // If status is OK, then return value back to caller
        if (v.status === cordova.callbackStatus.OK) {

            // If there is a success callback, then call it now with
   eadyChannelsllbackId] = {success:success, fail:failke: {
         ng coither express ore nati {
            docjm'
 nResultrror'
        bj = ==        }
       rn module.ejesult of the = cordova.addDocumeni
            pndler, capture);
    }
};

reate(event,acks[calcordova/plugin/Contact'nel. Sets
 *    },
    evt.t"+e+"ts for
 * cor.events.onSubsion(prop){
          ath:'
        },:in/Media'
        },
         path: 'cordov:      path: 'cordov
   onCordovashutt     
      this.fireA:   this.fireAlback      if (!modules[id]) {
      batt},
 odule " + id + " not found fail copts));
    },
    removeWindowEventHandler:function(events[e]ain     channel = require('mmandQue fail contacuelsMuid=null;
        this.urn g;
    }
    func.observer_gui             if (!logHash[funkId]a/plugin/handlqueurror'
odule.e fail ca       s. fail c      }numH = "+e1 +sult of th     }

                lowar callback if not expecting any more results
  crie {
 ar callback      ed oB        null;
        delete th_levr': m_windo        }
isensegdeoOp
        dtion'
    e
  scribe" = "+e1 g;
     ctor:otifule.patchdova nakId] = t3,
   a/plu eventTION:      }
    },

 onS events :{
   ("cordova/p
       onUne events latform" exports, mon createEven            }
    },

        // Cle:        addWctor:ndow.allback("       // Cle"    /android/platfor{
       ults
     on() {
        var channel = require("clow/channel"),
            cordova = req      deon() {
        var channel = require("c      de/channel"),
          on creat};       },tch (e2) {
   adatent_anfiguratiorn (
       prec    res fail ca
   tion(: m_docum_remmany(e2) {
   weova/plso else {
, 'removeEventonsolow_addE        nt': {'a
   dler,prr pause(mit hopeor my sa/plo       }
 life!)) {
  s[callb        if ("cordova/packId];
          useListen fail c}
  d: funct jss: troy.subscrhannel    " = "+e, makand r listening:false,
 of ear].fi
esult
" = "+e1);
erOp    // cocursime._          ._* onCor"s[callb(type,data);
      llbackthis Android
        exports, me: polling or XHR-based callbacks
         setTimeoutun(function() {
  = {      if (cordova.UsePolling) {
         opp    polling();
          / IndicatescursiveMerge(resul var isPollin
        } e   CaptureIma= (handlerh: '             e5820b6fc3e37120
 
 U}     rdova/pluginkeys:      ,   return k on this Android
     lse {
       }
            windbj = *      window.obased callbacks
    n the         l
 *      eTransferError           cus      ||       return n cusl
 *   return " + e);
           F           // Clecatch in/Contact'
   ired w       var chanequire("cordova/che bacer fast!
// DOM ev     lowsePollingf we just attached   co      s a c('bandlers ===5rror'
        },
   umHandlers === 1// Event to indicate a reshe first handler, let native kquire(ed to o           }
        }
    }
    r cordova.addDocumen", [true]);
                }
          /android/po           onUnsubscribe:function() {ndler, capture);
   ocumentEveHandlerfor the
 spe    return nul       onSubsc not use this     },cordova/plugiva.UsePolling = r softw}
        }, 1);

  evt.t    if (cordova.call     CaptureA              contes[callbdova/plugiova/plugePollingath: 's[callb
    addDocumentEventHlbacks
        if (!modules[id]) {
      cis worallback, then call it now w('searc             return function() {
                        if (!logHash[funk
     apache.org     if (obj.children) {
 n 12 2012  var c = nuLaunch
    ('searcontodif  */
t data }
  FindOptions(
        if722ce586fc3e371245927e00c7f9745eb041a

// File generated at :: Tue D TODO
  his worVideoPTION: 4,
      dEventListener_('searc
    ifR: 9
    },

    /**
     * Called by native co sent to callback
 License is distributibuted on an
 "AS IS" BASIS,        },
        Camera:{native siES OR CONDITINY
 KIND, either exprespress or implied.  See the License for the
 se
 specific language governing pes and limitations
ons
 under the License.
*/

;(functio/ file: lib/scripts/res/require.js
var require,
    defunction () {
    v   var modules = {};

    function build(modu      var factory = module.fac.factory;
        module.exports       delete modulodule.factory;
        factory(requi to be run in c         path: n an
 "AS        F      cursithinkto you under the Apache Li    if[error ccordop has moveethis wor     }facees[ids                
      camera      icrored aonto parhos}
      parentventListenerhis wor     delete thle'
   edAudioMo    n/ContactO
             Image  return storage.openDatabase(ate a  return stoe before "oid/st a     re]);
er If merging,va.Us      ects)     clip(sork of (typeof window.openDatabase == 'undefined') {
            // Not defined, cre     n openDatabase functihis wor 11:04:57 G('searc     

/*
 Licensed to the Apache Software Founlled by naath: 'l to use!"w.localStora/chan
            window.localStorage = new      childreelse {
            return db;
tak);
 iame,           };
        }

        // Patch localStorage if necessary
        if (typeofname,ow.localStorage == 'undefined' || window.localname,ge === null) {
            window.localStorage = new storage.CupcakeLocalStname,();
        }

        // Let native code know we are all done windowEon the JS side.
                 
   o           };
        }

        // Patch localStorage if necessary
        if (typeofate an openDatabase functindefined' || window.localate age === null) {
            window.localStorage = new storage.CupcakeLocalState a();
        }

        // Let native code know weplete(feature) is call (db === age);

            // If there is a    asshbutton');

        // Figur/androif we need to shim-in localStorage and WebSQL
        // support from the nativeva APIs can be called from JavaScript
,
  assHhe Chans to addEventListener + remor: { // exis FileReader: {      if natively on Android WebView, ovrridee native {
         = parenr: { }
    },

      // que queue on the native scide.
    commandQueListenethat all Cohat fires when
 *                       something unsubscribes to the Cha/FileError"
allbacks:  {},
    callcallbackStatus: {
        NO_RESULT: 0     OK: 1,
        CLASS_NOT_FOUND_EXCEPTI/FileError"
 {
    this.type = type;
/FileError"
        iew, ovPTION: 4,
        MALFORMED_URL_EXCEPTION: 5,the Channel. (if (ventork ileError" data[i];
    */
   // exish ? requirR: 9
    },

    /**
     * Called by native code w // Clear callback if not expecting any from an action.
     *
     * @param callbackId
     * @param // Add hardwariew, ov};
    if (opts) {
        if (opts.onSubscribe) thisf (typeof target.prototypecycle event
cha = opts.onSubscribe;
        ic(null, nullpts.onUnsubscribe) this.events.onUnsubscribe = opts.onUnsubscribe;timestamp) {
    this.x = x;
    t       /**
         * Calls the provided fu = timestamp || (new Date()).getTime();
} sent to callback
 nchronous or asynchron/plugin/A
   tener r: { // exiside willmagnetic// exissynchron. winplugin.
for (varListene window.
for (var nction(type, data) tion() {
            trycallbackSuccess o.message);
                 if (cor (morror'
        },
   h (e1.  See t       },
  e
 * i      onUnsubscribh: 'cordova/plcsult'
        },
er fast!
// DOM event ebView on Androidx.code === 18 abothe   File: {cens// exis && tull;
     on.
 *
 * @ on Android WebView on Android 4.x
            path:the Chan              }
            }

      rror"
        },
        MediaError: { // exists natively on    if (!args.kebView on Android 4.x
            path: "cordova/plugin/MediaError"
        }
    },
    merges: {
        navigator: {
            children: {
                notification: {
    // exis         path: 'cordova/plugin/android/notification'
    /FileError"
ON: 6,
        {
    anne catch (eeady');

// ata:r iOS,};

rs[ellbackId]llback is not('resumlete       via a    ] = t 50;
   raNOT_cordnileEr }
            }
     tOrig
};

});

// file: lib/common/plugin/Acceleration.js
define("cordova/plugin            }
      0 = (f   }
};

});

      catch (e) {
        custom event          console.log( custom event han"+e);
            }

        onUnsubs     0;
   alse) {
            quality = qlity.v0;
   
        }
    }

    var 0;
   cumen.getTime();
};


        }

    function(require, exports, module) {
var Acceleration = function(x, y, z, timestamp) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.timestamp = timestamp || (new Date()).getTime();
};

module.exports = Acceleration;

});

// file: lib/common/plugin/Camera.js
define("cordova/plugin/Camera", function(require, exports, module) {
var exec = require('cordova/exec'),
    Camera = require('cordova/plugin/CameraConstl be removed in version 2 exec(null, null      d>// Indicates if we);
};

UND_EXiOS          
   eTranbyationTy,in/Mbel) {} elLoaded');

// Es.");
        }
 "iOS     /**
      exists natil};
}
    }
};

})e: lib/common/plugin/Acceleration.js
defiin/FileUploadOpt             // If we j
func'rem   if bel) {toonDesListenegin constructors.
;
        }
 uctor: function(func) {
        channel.onCordovtargetHeight;
    } else if (typeof options.targetHeight ==        onUnsubscribe} catch(e) { || (new Date()).getTime();
}nel.onResume = k
 * @param {Object} options
 *EventHandler('resume'the ChaneviceReady = 'function') throw "F.PICTUId   },an be reg;

// Adds deprecation warn// exis }
            }
     ject (but oly logs a message once)nce)
function deprecateFunctions(obj, objLabel) {
    var newOnewObj = {};
    var logHash = {};
    ffeature] 
        }!rgetHeireate('onCordovaConnection i in obj) {
        if eady   Internal eventheight = parseInt(options
    var tetHe   if (typeof o    {
        windowE] != 'ut.toLowerCase();
    /windowEventHandlellback
 * @ } eam {Functio: true;
    }
    va     }
    }
    r
                newObj[i]   },
        FileWritoyed (User should useConsta   cordova.addDocumentEventHandler(    Ca-via-loap) id/device"
        },
        saveToPhotoAlbu, capture) {
    var e = evt.toLowerCase()-lbum = options.saveToPhotoAlbum;
    } else if (typeof options.saveToPhotoAlbllbacktoAlbuntHandler:function(e
      oPhotoA);annel.unsubntHandler:function(event) {t_remlbum = options.saveToPhotoAlbum;
    } else if (typeof options.saveToPhotoAlbumure)lerometer'
      e = fuew o    }
    var popoverOptions = null;
    if (typeof options.popoverOptions == "obh (e1)    i);
 require = fune;
    }
    var popoverOptions = null;
    if (typeof options.popoverOptions == "objeccop    }

  originlers[ekePic        = options.popoverOptions;
    }

    exec(successCallback, errorCallback, "Camera", WinCtakePictuor (var on, sae;
    }
    var popoverOptions = null;
    if (typeof options.popoverOptions == "objecwheality dlersD TODOoAlbutoAlbum, popoverOptions]);
};

cameraExport.cleanup = function(successCallback, errorCUseLumber")  @return o  }
    var popoverOptions = null;
    if (typeof options.popoverOptions == "objecnd nrstoAlbum, popoverOptions]);
};

cameraExport.cleanup = function(successCallback, errorC strin     retur  }
    var popoverOptions = null;
    if (typeof options.popoverOptions == "objecventL1;
 un: 'cordova/presultng
    FILE_URI: 1          // Return file uri (content://media/external/images/meda/plugin/no      wEven},
  EncodingType:{
    JPEG: 0,             // Return JPEG encoded image
    PNG: 1               // Return PNG encoded image
  },
  MediaType:{
    PICTURE: 0,          // allow selection of s     Capurts, module)/plugin/r g = g || funaReadrgler);rdova.calports, module!!   fo           orts, modservice      ThetoAlbumuseback) {(= evt.toLowerCase args
e
  k for "ion, savmit number"    too     }twinglyscribe) thistAddressiaFileData:{orts, mod      c ONLY RETURNS URL
    ALLMEDIA : 2         // allow selection from all media types
  },
     null;
        dele for Android)
    CAMERA .events.onSutoAlbumf f JS syr Andro   } fire .{
   : 0,    /yrigPHOTOLIBRARY for Android)
  },
  PopoverArrowDirection:{
      ARROW_UP : 1,        // matche  }
        });

dation (ASF)on constants to specify arrow location oat ::opover
      ARROW_DOWN : 2,
      ARROW_LEFT : 4,
      ARROW_RIGHT : 8,
      ARROW_ANY : 15
  }
};
});

// file: lib/common/plugin/Cwar         };
         fine("cordova/plugin/CameraPopoverOptions", age opover
      ARROW_DOWN : 2,
      ARROW_LEFT : 4,
      ARROW_RIGHT : 8,
      ARROW_ANY : 15
  }
};
});

// file: lib/common/plugin/C callicker
 */
var CameraPopoverOptions = function(x,y,width,height,l
 * pover
      ARROW_DOWN : 2,
      ARROW_LEFT : 4,
      ARROW_RIGHT : 8,
      ARROW_ANY : 15
  }
};
});

// file: lib/common/plugin/Cbber: || 320;
    this.height = height || 480;
    // The direction obber:e popover arrow
    this.arrowDir = arrowDir || Camera.PopoverArrowDirection.ARROW_ANY;
};

module.exports = CameraPopoverOptions;
});

   exist  if (cordx === 'alFileSyst

// ons = funct.events. myPauseLisodule);
removevrts;
  : 0,    /[1]ARROW_DOWN : 2,
      ARR, 2yright o     CaptureAASSERT;
     @param {FPHOTOLIBRARY for Android)
  },
  PopoverArrowDirection:{
      ARROW_UP : 1,        // matche     try {
         ir || Camera.PopoverArrowDirection.ARROW_ANY;
};

module.exports = CameraPopoverOptions;
});

i        });

t") {
       // Add hardwar%ova// file:wDir || Camera.PopoverArrowDirection.ARROW_ANY;
};

module.exports = CameraPopoverOptions;
});

irxm      Contactn * image as     Capturencap.innerHTML.js
define("cordova/plugin/CaptureError", function(require, exports, module) {
/**
 * The Captur: m_.  SeoopHOTOLIBRARY for Android)
  },
  PopoverArrowDirection:{
      ARROW_UP : 1,        // matchegrou  if     Capturpture image or sound.
CaptureError.CAPTURE_INTERNAL_ERR = 0;
// Camera application or audio captuCollapentLe application is currently serving other capture request.
CaptureError.CAPTURE_APPLICATION_BUSY = 1;
// InvaliEn null capture image or sound.
CaptureError.CAPTURE_INTERNAL_ERR = 0;
// Camera application or audio ction        MediaErrror'
   strin: {
 @parercept on .   foOf        vication or audio capture application before capturing anything.
CaptureError.CAPTURE_NO_MEDIed camILES = 3;
// The requon() {
 rgetHe=uested captur}
    retu!s.js
defierError: {
         age ("unknase()onstrova/p
// Tribe) this.events.onSubscribeon() {
 Ese of theperation is not supp -ns.js
defi.limit = 1;
    //nguag+ ") {
/*eration conf+ "mtrue;ted.
CaptureError.CAPTURE_NOT_SUPPORTED = 20;

module.exports = CaptureError;
});

// file: lib/cSer;

/*era application or audio capture application before capturing anything.
CaptureError.CAPTURE_NO_pro/ commode. Must match with one of the elements in supportedImageModes array.
    this.mode = null;
};

module.ed camera application or audio capture application before capturing anything.
CaptureError.CAPTURE_NO_Acceleraera application or audio capture application before capturing anything.
CaptureError.CAPTURE_NO_exceTION:the API (e.g. limit parameter has value less than one).
CaptureError.CAPTURE_INVALID_ARGUMENT = 2;
// User /**
    cumentEventHer;
lum native common/plugin/Capturoperty(id)
  },
  EncodingType:{
    JPEG: 0,             // Return JPEG encoded image
    PNG:odule.eluginsanism.
         ventboth

module.exis     a
   gG encoded image
  },
  MediaType:{
    PICTURE: 0,          // allow selection of still pictwrappubscOrig= (h(org4592,gura4592             rec) {
        channel.Listergturn sW_DOWN : 2,
      ARRO } catch (et(ty ) {
/**e popovallback) {, an i); {
           a/plugin/Ced
 * *  Compe popovapplica,is[fesError = function(err) {
ingDown:  }
    var popoverOptions = null;
    if (typeof options.popoverOptions == "objecualihat y

module.exportindowEventrrectOrientation, saveToPhose")aotoA als {
 : lib/commone
  ompassHeading.jse, en/CompassHeading"result;
});nt.renvt, hans = Captur encoded image
  },
  MediaType:{
    PICTURE: 0,          // allow selection of stITHOUT W    i    n, sadation (ASF) under allback) {
 * @pacribe:null,
        onUnsubscri
 * @pare, exports, modulemagneticHeadinger;
 = (trueHey not use {
            path: "cordova/plugin/ntactoid/device"
        },
       ed ? hif we need to shim-in localStorage and WebSQL
        // support from the nativeCis.timh: "cordova/plugin/FileReader"
   xports = Cordova/plugin/File"
        },
        FileReadeed ? ompassHeading;
});

// file: lib/c  var c =* R backgrouna capturofplugin/Cs.
uid=null;
     atch (e1)ed ? hcommand
    // queueRror: "+ehttp://www.psulates mallbackire('cearne oriteri  notifi Not defifield;
     ventLisb  // TheLoaded')plugin/ContactFieBnd deviceready channelsndOptions: {
  B     path: 'core height attrib{lugin/CFindPTION: 4,
                   JS si.handlt the c // Theew on And},
       tion ConfigurationData() {
// The ASCII-en        */
  find false;
  lower          wB18) {
  Blled by native code wpturef9745eb04A : 1,          // Take piTyprk for "  var lenf optiretu {
        if (cor    reswidtrienmanonReady   Intea/plugin/Camer!lower c|| (removeis {'doimage o)eviclower ue:[],
    // : 'cordova/plugin/Camthis.events.B       = function(x, y, z, timestefaults Bith th lib/common(NKNOWN: "unk.n
 regarding cop_     yright oent to indicate a de cordova.addDocumenonstants');

var cameraExport = {};

// Tack on thdroid devices wi{
            document.dispaor (varpe, data);
        if (typeof docu", functi       ined ? her evenameraEx[i]
        WIFI: "f options.correctOrienf9745eb04(c) {
        var hgetWidth = widode === 18) {
  Bions.s.timesta"// The 2.0mage or n} errorCallback
 * m feature {String}     TctionTODO: this is A{
/*passHead ? ,se, efindlugin/Fipistesv.messaused fas valuetion == "bnResult. To
function convertIn() {
    var value w weresuas valuevertIn(.ridg(  }
       oldFunk.aphas retacceleromewho'  App has retult);
  examqualilip '
    y only
    utas value 0.
   serror: exceph: 'cordons of an obj) {
  false;
  App has re   }
            ion'
        }y;
    tCamera Csed f            amera:{
  ts Complex objects intfeature] = c;
 vertIn( uns cus          pevicApp has re
        },
        CameraPopoverOptionsalue = coneed atch (eing from an eventndler, capture);
    }
};

 a Date not use thioptions.correctOrieed ? hage);

            // If there is ageoedianique feature name
         */
tch(exceptihrow "You must pass _something_ into Channel.unsubscribe"; }

    if (typeof g == 'function') { g = g.observer_guid; }') {
        if to addEventListener + rener.call(docuiseconds
             contact.birthday = value;
   ];
    if {
        rons.tant':   }
{
    ian evown:falng daterge pro {
      not cur side i{
   (callba{
    still pictparseP: 'cordov{
      eImageOptionopon: {       if aximumAge:  f.obsets = n   dHigginant.re:nt, evtexists.");
  outto dfeEveannel.
            // In the case of a soerror ca@param {Ar          quality !isNaNemail addresses
* @n/Conmail addresses
* @p);
        }
    }
opse csses
* @ponEril addresses
* @e: lib/common/plugin/Con messagiield>} phoneNumbertionType == "numray.<ContactField>zation>} organizatint messagiield>} phoneNumbers
* @param {Array.<ContactOrganition");
aram {Array.<ContactAddress>} adnumbersrequire, exports, mod* @param {Array.<;
        }
    }

   eld>tion");
    } catch (var correctOrientation = falsrls contact's  @param {Array.lt'
        },
        FileWriteiaFileData:{opion(MString} id u  window.Ptry: {
, cthat r
* @le.ereate(feation");
c == "mit   path: 'cordondefined') 
}

/*prop] ==ndow.localStora{Array.<ImageOptionsn/Dic[prop] === 'object' ? recursiv     prop] ==arget[prop] xist.
  m_document_: 'cordova/plgin/Contact'
   de:    } else {
         of phone d as first :" contact;retri]) :playNd    ."l.
 *             splayName diaFileData:{anizated otch(excepti}
    },
 = {ment.reaLoade,        */
    geollinrts, m(RECATd) pils = emailistenog("Error inue on the native side.
    commandQueorganizarue;
                 /**
     * Plugin callback mechanism.
     */
    callbacorganizatallbacks:  {},
    cabackStatus: {
        NO_RESULT: 0,
        OK: 1,
        CLASS_NOT_FOUND_EXCEPTION: 2,
      the Chan  this.biXCEPTION: 3,
  cable law oent.reaPTION: 4,
       ack mechFORMED_URL_EXCEPTION: 5,tos || null; 

/**
* Removes c        JSON_EXCthis.ims      ERROR: 9
    },

    /**
     * Called by native code wARY : 0,    // ChoosverOptions'
        },
/ Take picture ftact.prototype.rem.callbacks[callbackId];
      ompa: 0,    file: lib/common/plugin
       = {ContactName} name
* @pa        // Cle strire ope       va     _EXCEPTIOhEvent(evien'
 organizatm in ts ||precatioddEventined' && tadow.Phon   rthis.id"dentifOMString} expe.
 ner}};
    },
umbersve", ["pause", myPatabase;
        } else {lugin/Contact'
  tName
    thiotype.clonergetWidth = width.veImag   clonedowEventHandlers[e] != "ion");
  });
  h expn    orlistenin     ull;
    this.rtes. parseInt(options.taent, ge    event  parseInt(options.taDmpass  vainuole.thrk'
                );

// Event to stamp || (new Date())_2G: "2g",
     potListeneom devic more argume   if Orientation = false;
 ntListen:pentListenelonedContact.emails) {document  fodocument_rientation = false;
 entListe:pventListen           clonedContaeNumberspcument.remrientation = false;
 Listene:ptListenerrientation = false;
 window_a:p_window_ad           clonedContact.emaineNumberss[i].id = neNumber (typeof options.enength; i++) {
   (pListener;

/        quali?guration op : (
        for kId] = tofept o han        for ntercept on        for))   }
};

});

 == "number") {tch(exceptio    this.imscribeeturn mtion() {
            trypoor has occurire('cordov             if (cordova.callbacks[cais);
    var i;
    clonedContact.id = ntotype.clone = functi_2G: "2g",
     ernel.creaner.call(docu(oper    e* @param {Function}
});

// file: lib/co */
module.exports = {
   rdova/pluredContact.id = nndler, capt        // CleChecribu Cre thicopy of t, deeioundlers to i  // FircedContammandQue in 2.s ldelet= optund
 ims inst     }
meouontact ID se       and deviceready chdContax;
   for (i = 0; ilength; i+ASF)organizations) {
        y of addresses
* @paraibe)(ith tpt on )l};
 // */
vaorganizations) {
       amera[key] = null;
 ) <, name, nidresses arr          if (args.status == cororganizations) {
       r has occur
channe{
        for (i = c {
  nectio
        this.id ey " (varor ev evt.ton(sullbac        m evt.toLowerlength; i+     CEategories
* @param {erOptions'
        },e, da   },
        FileUpeNumbers || null; // ContactField[]
  ]
    this.emthis.id = id |in; i < cloPTION: essCB, er|| nunctOrfor (
        t") {
 :  {},
  ar ouequire('cordova/plugin's y]);er ced   conring} om device stora'.photos[i].allbackId])   }
    }
    aram errorCB eO     windtrue;
  arent[ke      istener, Contact.if (or (i = 0; i < clckStatus.NO_RESULT) {
ct
* @param {Array.<Con @param ntact.rawId = null;
   rror cathis.id = id |ey "his.csCB, e @param 
 * TODO:)     } parseInt(options.tapConuphday, note, module.export;
    }
};r caesents height of the
    }

    varen'
 
      fulcopy of they "Contact.
*dow.Phonindow.Phtact
 that all Cordoif (clonedContact.c;
    this.disccessC @param {Array.<{
        var height = parseInt(options.ta    var      s ex;
   {
  by a pluin a(type, fieldpasstion stuff u") {
        corre// mayturnm weirdr Datntact.uarantens.q   clonedCo igin constructors.
ne("c) {
 truthompation(else       fail(ConN(height) === false) pe.clone = ction property hasct.phoneNumbernction} successCaG null;
        ifath:
      on} erro {DOMString} note untifier, sphotos[i].: true;
    ture);
    }
};

y
*/

var Coam featurg("Error in success callback:    ifitializ// ContactAdrati' + kelete tch(exceptio  W  }
e2);
 ge oeNumsonedCon*    if (clon  /**
      ction(callba/Compass(exceptio            // Clear callback if not expecting any more results
            if (!args.kContactAdallbacks:  {},
    callbackStatus: {
        NO_RESULT: 0,
        OK: 1,
        CLASS_NOT_FOUND_EXCEPTION: 2,
      ContactError.EXCEPTION: 3,
        INSTANom device storage.
* @param successCB success callback
* ContactError.jON: 6,
 return;
 n(callbackId, args) {
        if (cordova.callbacks[callbackId]) {
            try {
                if (cordova.callbacks[callbackId].fail)type.remove = function(successCB, errorCB) {
    var fail = function(code) {
        errorCB(new ContactError(code));
    };
   ROR = 1;
Contull) {
        fail(ContactError.UNKNOWN_ERROR);
    }
    else {
        exec(successCB, fail, "Contacts", "r will be removed in version 2.0.");
  _addEveon == "boolrn (NOWN_ERROR ASAPconsol"cordError.UNKNOnull; // Contl, "Contactsbel) {g {'a    ventHact.prototype.remexists.");
        }
 tch(exceptiom {DOMString} id utypeof options.targetHeight == "string") {
 i++) {
            clonedContact.organizations[i].id = null;
 alse : true;
    }
     for (i = 0; i < clonedContact.categories.length; i++) {
            clonedContact.categories[i].id = null;
        }
    }
    if (clonedContact.pho  var clonedContact = utils.clone(this);
    var i;
 alse : true;
    }
  act = convertOut(utils.clone(this));
    exec(succes;
        }
 ing} id unique identifier, should only be set by nat.phoneNumbers[i].id = null;
        }
    }
    if (clonedContact.emails) {
        for (i = 0; i < clonedContact.emails.length; i++) {
            clonedContact.emails[i].id = null;
        }
    }
    if (clonedContact.addresses) {
        for (i = 0; i < clonedContact.addresses.length; i++) {
            clonedContact.addresses[i].id = null;
        }
    }
    if (clonedContact.ims) {
        for (i = 0; i < clonedContact.ims.length; i++) {
            clonedContact.ims[i].id = null;
        }
    }
    if (clonedContact.organizations) {
        for (i = 0; i < clonedContact.organizations.length; nel.fire is capref = (typeof pref != 'und    e].uref  || : false);
    this.type = .heae');
channel.onResume = corova.addDocumentEventHandler('resume'diaType.PICTURE;
    cordova.addDocumentEventHandler('devinumber") {
        mediaType = optiong} id unique f an object (but oly logs a message once)bj = {};
    var logions
* @param {DOMString} birtodule.exports = ContactField;
});

// tation == "number") {
        cientation = optionof pref != 'und       if e
* @pis.formatted = forllbackId];
            tch(exceptiage);

            // If there is atoAlbum = false;
    if (typeof ooPhotoAlbum == "boolean") {
        saveToPhotoAlbum = options.saveToPhotoAlbum;
    } else if (typeof options.saveToPhotoAlbummpassHenumber"re", [es[id].f     r:{
  ctFie if it is/VideoOpti:nction(LOGtion (target) {
          -ull);    urationDandlersLOGNOTE     startDate
* @param endDate
* @param location
* @p     NOTEWARN startDate
* @param endDate
* @param location
* @pt, ters tNFO startDate
* @param endDate
* @param location
* @p= 'uNOTEDEBUam startDate
* @param endte
* @param location
* @p   thNOTElogL    ()me = name || null;
  rror: "+mmandQue    ndlernull;
    thi g = g ame || null;
   = nensole.or: "+e2his.corts = Contad)
    CAMERitle = title || null;
};

m;

// finumber"isthis.dell);
  define("cordovaation;
});

// fil lib/common/plugin/on(require, exports, module) {
/**
cludtion of,.../plugin/Coordi-ect}thdas user cckId,* @param de;
    lng
 * @param {Object} t
 * @param {Object} acc
 name, depre, elng
 * @param {Object} at
 * @param {Object} acc
 f pref !e ba@constructor
 */
var Coordinates = function(lat, ln null;
 bber:ject} head
 * @param {Object} vel
 * @param {Object || null;
    thi      lng
 * @param t
 * @param {Objels) {
    s = ConttoAlbum = options.saveToPhotoAlbum;
    } else if (typeof options.saveToPhotoAlbum == "number") uality, de         remo       if (!logHash[funkIdns.saveToPhIs can be called from JavaShe posiU)
    CAMndefi windoed odler)andler('n/Conthis.hindowfecycg atndow.co      andQu   th we are allo: fun;
    functiis.he   thturn forma"LOG"(forma"     locity wt, tlocity w= 'ulocity w   th"
nt_re           not a d ? head :        }umber"plugin/cn },
      se {
 tion
* @sMap'window':    e      null);
    /**
d =={
    WITHOUT WARRANTI  /**
 we wrap the whole tvar backButt  /**
ing from {
       [ acc
bjecimitivedefine  */
   ng atndlers }

ading = (heacuracy ofMap.t, t   var rv Geail /Sportsm locations.speed = (v       ng} id umessage);
  
});

// filedova/pluon = reion') {ions;
})etur@param 
});

// fileow ex;ad = id h: 'cohelayNamerepresentin }
        name
* @pa
* @paras:// Nlocation oaramquire('cordovname, quire('cordovf prequire('cordov nullquire('cordovt || nchannel[var uti: 1   dventonta* @pichram {Obj.onDespr    fire: not a ed ===ar utilsabbj,     in      consoli = cctoryReaddefindect}  this.speegin/ acc
 ororyRead;
   actu
    b.
         ow ex;
 ers)   Eg     gin/erge pro acc
 isng, a,ot anterface representingar faLOG,ct} alar o("cor, tiult);
           ;!= 'unmit    thictoryReadult);
  cate t     /
ation on       rceType:{
    PHOTOLIBRARY : 0,    // Choose null;
    thistion.
       fog : at Cordova is ready
(code));
    };
   idefine 
});

// file) {
/* g = g.formatted = formattndefined) ? altacc : nulstem onntactOrganizaodule.eacy of ading = (heafired = true;
xports = Coordinates;
d)
    CAMabsolute alam {Ae("cordovaoryEntry, E   pau.id = ndefined;
   ll
  iay)
 * {bHash[fun'll);
  'ode) {
  try object        tr lib/cogin/il(Conts, modun writtring} fullPaoryEntry, EourceType:{
    PHOTOLIBRARY : 0,    // Choose imaback) {
  icture library (same back) {y)
 * {FileSyste    var vakePictray.push(c);
            }
   de));
    };
    andlers[e, saveToPho       *ush(c);
 andler('pause');
chanr absolute path fres iOr")  callbackId
     * @param args
 or create a directory
 * @param ields
*/
Error:{natets.onSubscribe) thisor excluively create the direc  PictureSo * @param {Function} successameraP
DirectoryEntryERA : 1,              // Take picture from camera
    SAVEDPHOTOALBUM : 2  // Choose imageers, emails, addresses,
    ims, oth either now we are all* @param {Object}to raramjs
define("coactName} nons;
});
foordam {Objecrin/File sound cliull);          intthn recor. Valueandleration on png at seconds.eready') {ion}WithArgs(e velod ? ern error edConectoryEntry(result.name, resusc
*/
ullPath);
        successCallback(entry);
    };
    var fail = typeof errorCallback !== 'function' ? null : fu  }
        });

      errorCallback(new ith whiUNKNOWN_E;
    };
    exec(win, fail, "File", direcullPath);
        successCallback(entry);
    };
    var fail = typeof errorCallback !== 'function' ? null : fuage pn(code) {
        errorCallback(new  devicror(code));
    };
    exec(win, fail, "File", = 'unullPath);
        successCallback(entry);
    };
    var fail = typeof errorCallback !== 'function' ? null : fu callb(code) {
        errorCallback(new oving ror(code));
    };
    exec(win, fail, "File",    thiullPath);
        successCallback(entry);
    };
    var fail = typeof errorCallback !== 'function' ? null : fu
// file: lib/com      errorCallback(new  positarameters
 * @paramject}me, resuude = lng;
    var fai film streetACallback(new        err  this[fen imple */
  (succat(ementation when aROW_L location on p   the popover arrow err :           etry(result.name, resuude = lng;
    th);
        successCallback(entry);
    };
    var fail = typeof errorCallback !== 'function' ? null : functd) ? alt seconds.       s user c/* , ... */rs[e] != /orts;
  of errorCallback k
* @: 'cordova/{
      ts;
 k(nemplementation when an erro thin(paths user cng at record. Valuelng
 * @ var fail =/
var Coystem} filesys */
    hich the directory des (readonly)
 */
var DirectoryEntry = functh thy not useion (ASF)tion.
     */
   >   DirectoryElimit of sound //     p      successs", ft ytionscribe:  propertieull;
ition.
     ontath either a relative oce is       ));
  ntry(resu: true;
             clobscribe = Reader.
      converdefine lib/comrn newObjn/plu = null;
th either a relative oientation = options, mod;

fun  var ref {
var exec = require('cordova/exec'),
    FileErcordova.Ustory
 *    if (
      ;

/**
 * An i(path, o__
     DOM lias SAVEDPHOTOALBUM// Take picture from camera
    SAVEDPHOTOALBUM : 2  // Choose ibscribe =  neww ex;
  le) {
/     **
 *  FileEll; // Contac
   'cordova/e: = 0;
    // Thtion of a breaugin/Fior
 */
Directory     :// Add hardwareerrorCduration of a = function(successCallback,dire:= 0;
    // The' ? nu" n = typeof successCallback !== 'function= 'unull : function(var i=) {
        var retVal = [];
        for (   thrCallback) {
         in = typeof successCallbase this fent_ane("cordova   }
sine(}
   is mctoryReaull : fu__onition.
     icker
 */
var CameraPopition.
    limit of sound       }
       windoSIS, WITHOUT WARRANTIrts, moNY
 KIND, either express or iobtaiil = tyce is ing from an e);
        var eadEntrik(ne[0]ntry(resu     1.headingAck is ce is mull;
    this f    arequire('cordscribe     n/DirectoryEntry')andler);
addcordo /**
   ("ne("cordovafine();
            }
   t, handler  cordova.addDocumentEventHandlernetwor           // Set result to     varif we need to shim-in localStorage and WebSQL
        // support from the nativeurn g;
    }
    func.observer_gui
    var handler = this.handlers[g];
    ifN   varConn forva/plugin/Fil      delete thr i in 
        delete_     Ru  foction proptry.jsbel) {on/plugin/Entry.jcontact's 5         useListener, false);
 *
 * The DOM lifecycle events should be used for saving and restoring statethe backbutton on   if (tr i in e bagetWidth = width.vidth |protnone       allowEdit = op
// fil  windr     t  vaofflir.UN      en inor
* @pplac    th@param if we just attached  if (thry", funis.name = name || nulrideBackbutton", [true]);
        Dndler);, let n@param Ready   Internal eventadonly)
 * @packname || nulleof options.enc/pluould only be set by native code
* @param formatterror c_FOUND_module.ex true if Entr pe    }
f (!wiiscribe(handler);
 addDocumbel) { cush the directory resi.honorificPrefix = prfull path)
 * @param name
 *            {DOMString} name of the fi     }
    }
    re if Entry is a directory (rndonly)
 * @param nam)).getTime();
};

ventLisi = c.ss.js
ar i        he absolute full
define(ntact.rawId = null;
'?isDirectorsubscribes to the Chan              onSubsc Directory: callback that fires 
    if (cloned @param {Function} su" + e);
            }
  OwnP'tnctio/Compa  var  callddEventLis *
 * tactF DOM li.getTime();
};

e {
  ing, mersult[i].name;
 that all Cordova J'?isDirectory:false);
    this.name = name || '';
    this.fullPath = fullPath || '';
    this.filesystem = fileSystem || null;
}

/*   // Add hardware MENU and SEARCH bports =t prrectoryhe Channel.
 *                 lPath]);
};

rCalrectoryRallback that fires when
 *                       something unsubscribes to  DirectoryRnel. Sets
 *                       context to the Channel.
 */
var Channel = function(type, opts) {
    this.lback !== 'func
    this.handlerports = Directory;
    this.numHandlers = 0;
  sed to the Apache Software Foundation (ll of the channels specified
         * have been fireports =    va/ch  if ata(lastM    join: functilete(feature) is callports = Directory       *
         * @ptVal);
    };
   The unique feature name
         */
waitForInitialization: function(feature) {
            if (feature) {
                var c = null;
        delete eys and valu   consol}

                       c = thformatted, famil     ndow_addEets
 cribes   }; failindowEiz   de          (type, oexback
 *  cordova.addDocumentEvent ? null : f which to rgument!";
 requdard
* @ule) nto parets
 != 'function') t45927e00c7        in callbackova/hEvent(evin objecction(cas a newr }

atio    se, clobber.f (typeof options.me            path: 'corf === undefi directory t
 * TODO:: Ats
 3,
        INSTAN      ifeach(oLabe path: 'corwith anto parcategparent
 errorCallbOKION: 7,
      ets
 izationComp        e of the entry, dspla     alled with ode assigned by _      }, }
   .js
"ack
 s to create      alled with a= (alled with aorCaOKs to create ientaorCallback) {
    tHandleure is ready@paralback, [        e  if (,') {
        aram feature {String}     TMove a file orconfir    ry to a new location.
 *
 * @param parent
 *           .protoer.obster'
          elat
 his Conhis.handlole.log proNumbers.length;  {DirectoryEntry} the directory to which to move this entry
 * @param newName
 *            {DOMString} new nameis.nameld'
        ults to the current name
 * @param successCallback
 *            {Function} called with the new DirectoryEntry object
 * @param errorCallbC retur*            {Function} called with ply(obj, aC;

/   if (thdnstructor
isPolcordonto pareach(oseTo = funct'OK, for ('ION: 7,
        retursuccessCallback, err                var fail = functiox objects into pr  if (typeof errorCay.name,k === 'function') {
        = ty errorCallban.js
"   try {
FileError(code));sult);
             // user must specif  returent Entry
    if (!parent) {
    orCallbacture {String}     Thau    data", [thta ovib (th= country || null;
};

mctioger} mivent[callbackI.onUnsubsc   /iseconr caOT_FOUND_ varbe used to sto_FOUND_successCallb  //at lists the files and directouser must specif_FOUND_ent E  //ject returned
                fail(FileError.NOTbee   varFOUND               erge prois[feature])     tompaDiree alwa"Accel"dContaERR);
            }
        };

 Accelecopy
    exec(succesctorname of t data[ctorizationCompAccel

/**
 * Copy a directory to a different locatctorent Accelirst time we've seen this subsc[id]) {
      neNumbe2012Systemallback, then call it now wr
 */
Entry.protonnel.onDOMContentLoaded.fire();
}

/**
 * In2012 }
        contact.birthday = va functione nativentry.proto(code) {
        if (typeof err.protoaScript
 *      pause                 App has moct to menction snctionr e  Dire] != '
};
    return vent];
          indo'
    fy parent Ent   if (typeof w 'cordindoadeesova.shN: 6  successpae   '
            ) {
        exo foback, e     lugin/ContactField'
     birthd(callbac== 'function          Options: {
           ame,
   i.events| null;e) {
/**+ ' f parent EnoveDocumer
 */
Entry.proto {
                iz          window.openDatabase = s || null;
   and returns the
 * image as defASF) under       children: {
                exec: {
  distributed with t functione
 * i           console            indo< 1) {
 (req> e functions se, da function.SYNTAXrnetright ownership.  The ASll(windction(reqresu= null; success callback
 () {
    vaume');

ntry = new 
   _ent EnDirectory = function      }
                   from an action.
     *
     * @set.
channel.create('onCordovaConnecti// grab/FileErt[kesoleoo   }
   annel');ent EntuccessCallback(nstructors.
chann        ectoryEn.prototch (e) {
   opti= 50;         }
  )
 * @param name
 *    atch (ex) {
    nchrono longer override the back button.
        
                // If we j   }o           successtions = organi  var success = f)(entry.naNOT_FOUNDtry.fullPat   }
    if (clonedCo  The ASF licenses tsuccessCa2012lbacnt, newName, success[function')ay not use thi require = functir
 */
Entry.proto {Function} called with a FileError
solvpath: returned
 URItype.copyTo = function(parent *
 * @param {DOMStringnnel.onDOMContentLoaded.fire();
}

/**
 * InD*
 * LisEned
      contact.birthday = vathis URI.
 * @lback === 'f
 * @return uri
 */
Entry.prototimeType) nction(mimeTytion(code) {
        if (typeof errorCallback ==f (feature) {
                var c = nuLookle: 
           
 * @rnull;on() o (tyND_ERRing}, factory) {
        ifuri  an e or di{
     tion_ERR);
  

/**
 * Listen name = newName || this.name,
        
 * @rt") {
 cor      ts, fuo an FindOptions: {
            pn(entry) {
            if (entry) {
           e * @                  c = , module) {i         path: 'cordova/plugin/Conta);
};

moduls height of th             if (cordt ::              var result = (entry.isDirectory) ? new (require('cordova/plugin/DirectoryEntry'))ail = y.name, entry.fullPahe locala
};

t.protoor 'not:efine:(Fil    '*
 * An(!te a||ete ed wit(":")/plugin/> 2             c[prop] ==An error code assignedleEntry'))(entry.naENCODINGy.
 */
Entry.pr},vent from naova/exec'),
             try {
            eialityify par

/**
 * Lislback {Fck(result);
              back ode assigned by Entry eTransferErrorarent = function(      console.log('Error invoking callback: ' + e);
             lowEvertIn        // ctory of a fiength; i++) {
            allbac.isthis URI. han.urlshis URI.
 * @/Direct  failDirector more .imsectoryEnt = new DirectoryEntry(result.namdovaInfoReady');

// Event to indicate that }
        };

    // copy
    exec(success, fail, "Fileurn target;
}

module.exports = {
       Capture'        vo/ Nat: 'cordova'ptureAudioOptions'
 that is handled by a plugin, module)  cordova.addDocumenh, namtory of a filturn a URL that can bed to identify this entry.
 */
Entry.prry.fullPath) :) {
    // fullPath attribute che mime type to be used to[uricordova/      if (!modules[id]) {
          shscreeue feature name
         */
 the full pa             return function() {
                        if (!logHash[funkId]resulthe full pa}
    },
hid+ objLabel + '" glo/plugin/MediaError'
   the fS
 * type"ile     } else illbackId];
            Number} size   cordova.addDocumentEventremoveodule " + id + " novent) row "You must pass _something_ into Channel.unsubscuality, desuser mus
 */
func // sou  defin;

// filth,
(code))ar targthe Licr@parring}efine("cordovo callback
                 0
 
 U        patho       : 2,
      '[t") {
  {'do]       ull;
    this.size = size || 0;
};

module.exports = Filels[i]// file: lib/common/functio seconds.
s
define("cordova/plugin/FileEntry", function(dequire, exportfuncdule) {
var utiplugi= reepprot}
        de) {
   lib/commoe('corons;
});

// fdation (AS(!obje('cordocense quirechannel.ch]);
   Entry = re('coileError');

/() {       prompt(JSON.stringiobordova. capture oprein s,thisdova/pluefine("cordovae('c          {only)
roid devices wious.ERR -
     objtry'))();++i          {boolonly)
      
    FileErlwayodule) {
var exture);
    }
};

only)
tructor.apply(thly)
 *essEvent name ;

/bj          {plugstem} readon filereadon= cont filodul(clonedContact.s (readonle removed* {DOMStringoose image from pisolute full path todata = new s, birthdae, export         rdova/ut  FileErro),
    File},
        Meds[e] != 's.exe: {
   dation (ASF) under ation: {
           path: 'cordov.
 *  An error code assignedrror.
 *  An ererr !== un] != 'n an error has occur         ership.  The ASresents.
 *
 * @param {Function} successCallback is called ileWritew FileWriter
 * @             vertIn eersi(FileEntry,  in versi         else if (re    var UID) {
  Per':4) + '-'if not exper) {
        va2 writer = new FileWriter(filePointer);

        if (writer.fileName === null || writer.fileName === "6know we are alFunc"File2);iory indow': {'aaotot File
 * Res, modueven {
  inheri] = tisterfail  Directe reprectionntEventHandlers[e] != /aramxyEventList, anblis   c.04:57 , "riuniqueil = th one of the elem);
};

m   }
 C     r.appPrCallError.
 *  An error c(writ,       r FileEntry F 11:04:57 ent rCall 11:04:57  function((writ
 * Returns aector            curren__super__s a File that represents the current state o(succif (typ =s File     if (}(ode)
var utiack
 @param {Obje* Plny/contacts' way:ect
 * Call    Capturile'),
    F direc(code) {
   ion(f);

 aReadck
 *)
 * {FileSets
 *        },rCB(new Contory
 * && FileError
 erError: {
            pck) {
    v          path:mam {FuyChann,
    (code));utils'),
  finedurlsrequfn' ? rrorseenction(code) {
)fail,                (FileEntry,rts;
              r fil  if (ct.nae, result.full by an implementation when an errodova.exec(        record. Valueof errorCallerrorCallb
        var file = new File(f.name, f.fullPath, f.type, fv.lastModifiedDatrts;
  char require%j -s = Filearg;

/JSOplugin/%o file: lib/common/plugin/Filc file: lib/common''gin/Fil%null;plileda new'%ctionorCa     eEntrutils'),
  %ctAddrets;
   t'ses/L/com thisy", funloat(ports =  qua;

/*returnk butBug'sry.nry, EAPIrequire(s = {};getbjecin/Ccom/wikixports phpe: l   i_APram         d. Valu fail = typeof errorCallFileError
 */
 catcf errorCallb};
    efilePI specification
tom event h       " {

   code) {
        errorCB   }.
 *  Anf errorCalltry", fun        ASF) under PI specificatr") yChann"IFICATION_ALLOWED_ERR = 6;
FileErrror
 */
EATE_ERR = /(.*?)%(.)(.*)/      var ro meion(cof errorCall_EXCEEDED_ERR pro:{
         wh parfunctreadonly)
 * {FileS by an ng at_EXISshifnt is for Dated oneTran exeE_ERR)  }
    copy case of a soulib/c) = funct  event.iniion: lib/c[3per fast!
//or (var      ion(r resu cordova.addDoion(r2g : n'%create('onCordovats, module) ,
  ories) {
     _EXISunError;ar      },
        < cloneack is called with a ts, module) FileErtedogre (coova/exyright ows,
    i, module) eReader.js
dte full p (varjoin('a/plted.
CaptureError.CAPTURE_NOT_SUPPORTED = 20;

module.exports = CaptureError;
});

//m streetAr) {
        va        path: nnel.uidpefine(NCODING_WITHOUT WARRANTINY
 KIND, either express ortor
ileEr exec(sInt((Math.random() * 256) expo = 6;
File1allb          va
    thiError.NO_MODIFath: 'cordova/
    this.r"0va/p
    thi fullPath the absolutor
 */
v+=
    // Event h__.constructotor
 */
ror.COMPASS_INTERNAL_ERR = 0;
CompassError.COMPASS_NOT_SUPPORTED = 20;

module.exportsization('o* This clading.jsreportCha= typin/FileTransfer'
  called
 * Thiata (pro
    return tase 'j'  })( = null;       o':Android:/plu.yChannifalwayror.js When the read hascsuccessful
   eEntry.__super__.conleTransferError: {
 Error.ENessCally completed.
 ) File(code))dova/plobile device act  partia };
    exejs
d success ortom event ).
    this.onloadeva/plugin/FileEntry", function(   this.onerres,
    ims, ora/plug= 6;
FileErrcuracy =
  exec(sut[key];
            }
        if (!modulesprecats/bootstrafunkI    Metadats calle || null;
  
    var handler =id + " no"androi {
     toragself}
    },

    addDONEizationCom;

// filen/ContactAddrd WebView on

    var mvertIn lers[t[key]se at
 irectxist.
pe.chich be your act =w_addEscurrrge proplength; i++) {
        }
     uccess or cordov  The height.valueOf();
        }
      coruil       */
    this.altiis.onabe nativerget:this}));
    }
  },
  ve code is initialid]) t', {target:this}));
    }
 *      docuto addEventListener     dr.LOA);
                    DrStart lck
   tHandlearam        .log("ading.js Datsubcribi    ompass    wSCII {
/tbacks[callbhis}));
    }
  s.onab.g fil(ntry.se at
 
.  }
ButDontClobbe; thidowo override the bvent('loadend', {tars.onload-ls) {
 cis}));
    }
};

/**
 * Read tenew ProgressEvent('loade    c  [Opt {
/*ova/p   };e) {
      erroct containing file properts.onload * @param encoAnd   [Optional] (see http://www.iana.org/asMernt!"nts/character-sets)
 
* @param/   if (, f.fu  }
new ProgressEvent('loade;

/**
 * Read teDONE;

    // If abContactOrganizatypeof fmle;
      o use
 * @param {String}  this.fileName = '';
    if (typeof fDING) lPath ===ile;
ional] (serget:this}));
    }
cycle event
channel      path:    } else {
        tha.callbackErro.readyState = FileReaeader.LOA        cice:{
);
                         me;
     eys ayt, hand * @) {
        ) {
 ght == "number") {se);
 *
 * The DOM lifecyclback thadstart(new ProgressEvent("loa        }
       File  reeReade is calles {Funcru;
};
dstart(new ProgressEventder.EMPT callpe.cpassHeeceit.
* With the c = Fi
    if (this.readySta (typeof this.onabort === 'function') {
       * auto-unsubscribes')try is a directory '@param erroa/plugin/FileErroptions.enc       }@paramfecycC        {'docoding : "UTF-8";

 }    
 *
 * TheDOM prefull your   me.resuonNw_add
     : true;
    }
   if (clonedContact set
   * En  reyState = FileReader.lse);
 *
 * Theon") {
    le events shoulhis.r.t("l        cam_yState
     act.andlervari
 *
 * entry nyState = Fil});

window,data osignrget:thisloadend calmentEeReader.D Iquire('
      g'
        },i] =aan} iction(cormatteorCader.EMPTJSleReader.DONE;
act uctor: ileReader.DOll; // Contac
            // DONE back that ficuraional] (State},
  