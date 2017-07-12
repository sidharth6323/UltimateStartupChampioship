/*!
waypoints - 4.0.0
Copyright © 2011-2015 Caleb Troughton
Licensed under the MIT license.
https://github.com/imakewebthings/waypoints/blob/master/licenses.txt
*/
(function () {
  'use strict';
  var keyCounter = 0;
  var allwaypoints = {};
  /* http://imakewebthings.com/waypoints/api/waypoint */
  function waypoint(options) {
    if (!options) {
      throw new Error('No options passed to waypoint constructor');
    }
    if (!options.element) {
      throw new Error('No element option passed to waypoint constructor');
    }
    if (!options.handler) {
      throw new Error('No handler option passed to waypoint constructor');
    }
    this.key = 'waypoint-' + keyCounter;
    this.options = waypoint.Adapter.extend({}, waypoint.defaults, options);
    this.element = this.options.element;
    this.adapter = new waypoint.Adapter(this.element);
    this.callback = options.handler;
    this.axis = this.options.horizontal ? 'horizontal' : 'vertical';
    this.enabled = this.options.enabled;
    this.triggerPoint = null;
    this.group = waypoint.Group.findOrCreate({
      name: this.options.group,
      axis: this.axis
    });
    this.context = waypoint.Context.findOrCreateByElement(this.options.context);
    if (waypoint.offsetAliases[this.options.offset]) {
      this.options.offset = waypoint.offsetAliases[this.options.offset];
    }
    this.group.add(this);
    this.context.add(this);
    allwaypoints[this.key] = this;
    keyCounter += 1;
  }
  /* Private */
  waypoint.prototype.queueTrigger = function (direction) {
    this.group.queueTrigger(this, direction);
  };
  /* Private */
  waypoint.prototype.trigger = function (args) {
    if (!this.enabled) {
      return;
    }
    if (this.callback) {
      this.callback.apply(this, args);
    }
  };
  /* Public */
  /* http://imakewebthings.com/waypoints/api/destroy */
  waypoint.prototype.destroy = function () {
    this.context.remove(this);
    this.group.remove(this);
    delete allwaypoints[this.key];
  };
  /* Public */
  /* http://imakewebthings.com/waypoints/api/disable */
  waypoint.prototype.disable = function () {
    this.enabled = false;
    return this;
  };
  /* Public */
  /* http://imakewebthings.com/waypoints/api/enable */
  waypoint.prototype.enable = function () {
    this.context.refresh();
    this.enabled = true;
    return this;
  };
  /* Public */
  /* http://imakewebthings.com/waypoints/api/next */
  waypoint.prototype.next = function () {
    return this.group.next(this);
  };
  /* Public */
  /* http://imakewebthings.com/waypoints/api/previous */
  waypoint.prototype.previous = function () {
    return this.group.previous(this);
  };
  /* Private */
  waypoint.invokeAll = function (method) {
    var allwaypointsArray = [];
    for (var waypointKey in allwaypoints) {
      allwaypointsArray.push(allwaypoints[waypointKey]);
    }
    for (var i = 0, end = allwaypointsArray.length; i < end; i++) {
      allwaypointsArray[i][method]();
    }
  };
  /* Public */
  /* http://imakewebthings.com/waypoints/api/destroy-all */
  waypoint.destroyAll = function () {
    waypoint.invokeAll('destroy');
  };
  /* Public */
  /* http://imakewebthings.com/waypoints/api/disable-all */
  waypoint.disableAll = function () {
    waypoint.invokeAll('disable');
  };
  /* Public */
  /* http://imakewebthings.com/waypoints/api/enable-all */
  waypoint.enableAll = function () {
    waypoint.invokeAll('enable');
  };
  /* Public */
  /* http://imakewebthings.com/waypoints/api/refresh-all */
  waypoint.refreshAll = function () {
    waypoint.Context.refreshAll();
  };
  /* Public */
  /* http://imakewebthings.com/waypoints/api/viewport-height */
  waypoint.viewportHeight = function () {
    return window.innerHeight || document.documentElement.clientHeight;
  };
  /* Public */
  /* http://imakewebthings.com/waypoints/api/viewport-width */
  waypoint.viewportWidth = function () {
    return document.documentElement.clientWidth;
  };
  waypoint.adapters = [];
  waypoint.defaults = {
    context: window,
    continuous: true,
    enabled: true,
    group: 'default',
    horizontal: false,
    offset: 0
  };
  waypoint.offsetAliases = {
    'bottom-in-view': function () {
      return this.context.innerHeight() - this.adapter.outerHeight();
    },
    'right-in-view': function () {
      return this.context.innerWidth() - this.adapter.outerWidth();
    }
  };
  window.waypoint = waypoint;
}());
(function () {
  'use strict';
  function requestAnimationFrameShim(callback) {
    window.setTimeout(callback, 1000 / 60);
  }
  var keyCounter = 0;
  var contexts = {};
  var waypoint = window.waypoint;
  var oldWindowLoad = window.onload;
  /* http://imakewebthings.com/waypoints/api/context */
  function Context(element) {
    this.element = element;
    this.Adapter = waypoint.Adapter;
    this.adapter = new this.Adapter(element);
    this.key = 'waypoint-context-' + keyCounter;
    this.didScroll = false;
    this.didResize = false;
    this.oldScroll = {
      x: this.adapter.scrollLeft(),
      y: this.adapter.scrollTop()
    };
    this.waypoints = {
      vertical: {},
      horizontal: {}
    };
    element.waypointContextKey = this.key;
    contexts[element.waypointContextKey] = this;
    keyCounter += 1;
    this.createThrottledScrollHandler();
    this.createThrottledResizeHandler();
  }
  /* Private */
  Context.prototype.add = function (waypoint) {
    var axis = waypoint.options.horizontal ? 'horizontal' : 'vertical';
    this.waypoints[axis][waypoint.key] = waypoint;
    this.refresh();
  };
  /* Private */
  Context.prototype.checkEmpty = function () {
    var horizontalEmpty = this.Adapter.isEmptyObject(this.waypoints.horizontal);
    var verticalEmpty = this.Adapter.isEmptyObject(this.waypoints.vertical);
    if (horizontalEmpty && verticalEmpty) {
      this.adapter.off('.waypoints');
      delete contexts[this.key];
    }
  };
  /* Private */
  Context.prototype.createThrottledResizeHandler = function () {
    var self = this;
    function resizeHandler() {
      self.handleResize();
      self.didResize = false;
    }
    this.adapter.on('resize.waypoints', function () {
      if (!self.didResize) {
        self.didResize = true;
        waypoint.requestAnimationFrame(resizeHandler);
      }
    });
  };
  /* Private */
  Context.prototype.createThrottledScrollHandler = function () {
    var self = this;
    function scrollHandler() {
      self.handleScroll();
      self.didScroll = false;
    }
    this.adapter.on('scroll.waypoints', function () {
      if (!self.didScroll || waypoint.isTouch) {
        self.didScroll = true;
        waypoint.requestAnimationFrame(scrollHandler);
      }
    });
  };
  /* Private */
  Context.prototype.handleResize = function () {
    waypoint.Context.refreshAll();
  };
  /* Private */
  Context.prototype.handleScroll = function () {
    var triggeredGroups = {};
    var axes = {
      horizontal: {
        newScroll: this.adapter.scrollLeft(),
        oldScroll: this.oldScroll.x,
        forward: 'right',
        backward: 'left'
      },
      vertical: {
        newScroll: this.adapter.scrollTop(),
        oldScroll: this.oldScroll.y,
        forward: 'down',
        backward: 'up'
      }
    };
    for (var axisKey in axes) {
      var axis = axes[axisKey];
      var isForward = axis.newScroll > axis.oldScroll;
      var direction = isForward ? axis.forward : axis.backward;
      for (var waypointKey in this.waypoints[axisKey]) {
        var waypoint = this.waypoints[axisKey][waypointKey];
        var wasBeforeTriggerPoint = axis.oldScroll < waypoint.triggerPoint;
        var nowAfterTriggerPoint = axis.newScroll >= waypoint.triggerPoint;
        var crossedForward = wasBeforeTriggerPoint && nowAfterTriggerPoint;
        var crossedBackward = !wasBeforeTriggerPoint && !nowAfterTriggerPoint;
        if (crossedForward || crossedBackward) {
          waypoint.queueTrigger(direction);
          triggeredGroups[waypoint.group.id] = waypoint.group;
        }
      }
    }
    for (var groupKey in triggeredGroups) {
      triggeredGroups[groupKey].flushTriggers();
    }
    this.oldScroll = {
      x: axes.horizontal.newScroll,
      y: axes.vertical.newScroll
    };
  };
  /* Private */
  Context.prototype.innerHeight = function () {
    /*eslint-disable eqeqeq */
    if (this.element == this.element.window) {
      return waypoint.viewportHeight();
    }
    /*eslint-enable eqeqeq */
    return this.adapter.innerHeight();
  };
  /* Private */
  Context.prototype.remove = function (waypoint) {
    delete this.waypoints[waypoint.axis][waypoint.key];
    this.checkEmpty();
  };
  /* Private */
  Context.prototype.innerWidth = function () {
    /*eslint-disable eqeqeq */
    if (this.element == this.element.window) {
      return waypoint.viewportWidth();
    }
    /*eslint-enable eqeqeq */
    return this.adapter.innerWidth();
  };
  /* Public */
  /* http://imakewebthings.com/waypoints/api/context-destroy */
  Context.prototype.destroy = function () {
    var allwaypoints = [];
    for (var axis in this.waypoints) {
      for (var waypointKey in this.waypoints[axis]) {
        allwaypoints.push(this.waypoints[axis][waypointKey]);
      }
    }
    for (var i = 0, end = allwaypoints.length; i < end; i++) {
      allwaypoints[i].destroy();
    }
  };
  /* Public */
  /* http://imakewebthings.com/waypoints/api/context-refresh */
  Context.prototype.refresh = function () {
    /*eslint-disable eqeqeq */
    var isWindow = this.element == this.element.window;
    /*eslint-enable eqeqeq */
    var contextOffset = isWindow ? undefined : this.adapter.offset();
    var triggeredGroups = {};
    var axes;
    this.handleScroll();
    axes = {
      horizontal: {
        contextOffset: isWindow ? 0 : contextOffset.left,
        contextScroll: isWindow ? 0 : this.oldScroll.x,
        contextDimension: this.innerWidth(),
        oldScroll: this.oldScroll.x,
        forward: 'right',
        backward: 'left',
        offsetProp: 'left'
      },
      vertical: {
        contextOffset: isWindow ? 0 : contextOffset.top,
        contextScroll: isWindow ? 0 : this.oldScroll.y,
        contextDimension: this.innerHeight(),
        oldScroll: this.oldScroll.y,
        forward: 'down',
        backward: 'up',
        offsetProp: 'top'
      }
    };
    for (var axisKey in axes) {
      var axis = axes[axisKey];
      for (var waypointKey in this.waypoints[axisKey]) {
        var waypoint = this.waypoints[axisKey][waypointKey];
        var adjustment = waypoint.options.offset;
        var oldTriggerPoint = waypoint.triggerPoint;
        var elementOffset = 0;
        var freshwaypoint = oldTriggerPoint == null;
        var contextModifier, wasBeforeScroll, nowAfterScroll;
        var triggeredBackward, triggeredForward;
        if (waypoint.element !== waypoint.element.window) {
          elementOffset = waypoint.adapter.offset()[axis.offsetProp];
        }
        if (typeof adjustment === 'function') {
          adjustment = adjustment.apply(waypoint);
        } else if (typeof adjustment === 'string') {
          adjustment = parseFloat(adjustment);
          if (waypoint.options.offset.indexOf('%') > -1) {
            adjustment = Math.ceil(axis.contextDimension * adjustment / 100);
          }
        }
        contextModifier = axis.contextScroll - axis.contextOffset;
        waypoint.triggerPoint = elementOffset + contextModifier - adjustment;
        wasBeforeScroll = oldTriggerPoint < axis.oldScroll;
        nowAfterScroll = waypoint.triggerPoint >= axis.oldScroll;
        triggeredBackward = wasBeforeScroll && nowAfterScroll;
        triggeredForward = !wasBeforeScroll && !nowAfterScroll;
        if (!freshwaypoint && triggeredBackward) {
          waypoint.queueTrigger(axis.backward);
          triggeredGroups[waypoint.group.id] = waypoint.group;
        } else if (!freshwaypoint && triggeredForward) {
          waypoint.queueTrigger(axis.forward);
          triggeredGroups[waypoint.group.id] = waypoint.group;
        } else if (freshwaypoint && axis.oldScroll >= waypoint.triggerPoint) {
          waypoint.queueTrigger(axis.forward);
          triggeredGroups[waypoint.group.id] = waypoint.group;
        }
      }
    }
    waypoint.requestAnimationFrame(function () {
      for (var groupKey in triggeredGroups) {
        triggeredGroups[groupKey].flushTriggers();
      }
    });
    return this;
  };
  /* Private */
  Context.findOrCreateByElement = function (element) {
    return Context.findByElement(element) || new Context(element);
  };
  /* Private */
  Context.refreshAll = function () {
    for (var contextId in contexts) {
      contexts[contextId].refresh();
    }
  };
  /* Public */
  /* http://imakewebthings.com/waypoints/api/context-find-by-element */
  Context.findByElement = function (element) {
    return contexts[element.waypointContextKey];
  };
  window.onload = function () {
    if (oldWindowLoad) {
      oldWindowLoad();
    }
    Context.refreshAll();
  };
  waypoint.requestAnimationFrame = function (callback) {
    var requestFn = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || requestAnimationFrameShim;
    requestFn.call(window, callback);
  };
  waypoint.Context = Context;
}());
(function () {
  'use strict';
  function byTriggerPoint(a, b) {
    return a.triggerPoint - b.triggerPoint;
  }
  function byReverseTriggerPoint(a, b) {
    return b.triggerPoint - a.triggerPoint;
  }
  var groups = {
    vertical: {},
    horizontal: {}
  };
  var waypoint = window.waypoint;
  /* http://imakewebthings.com/waypoints/api/group */
  function Group(options) {
    this.name = options.name;
    this.axis = options.axis;
    this.id = this.name + '-' + this.axis;
    this.waypoints = [];
    this.clearTriggerQueues();
    groups[this.axis][this.name] = this;
  }
  /* Private */
  Group.prototype.add = function (waypoint) {
    this.waypoints.push(waypoint);
  };
  /* Private */
  Group.prototype.clearTriggerQueues = function () {
    this.triggerQueues = {
      up: [],
      down: [],
      left: [],
      right: []
    };
  };
  /* Private */
  Group.prototype.flushTriggers = function () {
    for (var direction in this.triggerQueues) {
      var waypoints = this.triggerQueues[direction];
      var reverse = direction === 'up' || direction === 'left';
      waypoints.sort(reverse ? byReverseTriggerPoint : byTriggerPoint);
      for (var i = 0, end = waypoints.length; i < end; i += 1) {
        var waypoint = waypoints[i];
        if (waypoint.options.continuous || i === waypoints.length - 1) {
          waypoint.trigger([direction]);
        }
      }
    }
    this.clearTriggerQueues();
  };
  /* Private */
  Group.prototype.next = function (waypoint) {
    this.waypoints.sort(byTriggerPoint);
    var index = waypoint.Adapter.inArray(waypoint, this.waypoints);
    var isLast = index === this.waypoints.length - 1;
    return isLast ? null : this.waypoints[index + 1];
  };
  /* Private */
  Group.prototype.previous = function (waypoint) {
    this.waypoints.sort(byTriggerPoint);
    var index = waypoint.Adapter.inArray(waypoint, this.waypoints);
    return index ? this.waypoints[index - 1] : null;
  };
  /* Private */
  Group.prototype.queueTrigger = function (waypoint, direction) {
    this.triggerQueues[direction].push(waypoint);
  };
  /* Private */
  Group.prototype.remove = function (waypoint) {
    var index = waypoint.Adapter.inArray(waypoint, this.waypoints);
    if (index > -1) {
      this.waypoints.splice(index, 1);
    }
  };
  /* Public */
  /* http://imakewebthings.com/waypoints/api/first */
  Group.prototype.first = function () {
    return this.waypoints[0];
  };
  /* Public */
  /* http://imakewebthings.com/waypoints/api/last */
  Group.prototype.last = function () {
    return this.waypoints[this.waypoints.length - 1];
  };
  /* Private */
  Group.findOrCreate = function (options) {
    return groups[options.axis][options.name] || new Group(options);
  };
  waypoint.Group = Group;
}());
(function () {
  'use strict';
  var $ = window.jQuery;
  var waypoint = window.waypoint;
  function JQueryAdapter(element) {
    this.$element = $(element);
  }
  $.each([
    'innerHeight',
    'innerWidth',
    'off',
    'offset',
    'on',
    'outerHeight',
    'outerWidth',
    'scrollLeft',
    'scrollTop'
  ], function (i, method) {
    JQueryAdapter.prototype[method] = function () {
      var args = Array.prototype.slice.call(arguments);
      return this.$element[method].apply(this.$element, args);
    };
  });
  $.each([
    'extend',
    'inArray',
    'isEmptyObject'
  ], function (i, method) {
    JQueryAdapter[method] = $[method];
  });
  waypoint.adapters.push({
    name: 'jquery',
    Adapter: JQueryAdapter
  });
  waypoint.Adapter = JQueryAdapter;
}());
(function () {
  'use strict';
  var waypoint = window.waypoint;
  function createExtension(framework) {
    return function () {
      var waypoints = [];
      var overrides = arguments[0];
      if (framework.isFunction(arguments[0])) {
        overrides = framework.extend({}, arguments[1]);
        overrides.handler = arguments[0];
      }
      this.each(function () {
        var options = framework.extend({}, overrides, { element: this });
        if (typeof options.context === 'string') {
          options.context = framework(this).closest(options.context)[0];
        }
        waypoints.push(new waypoint(options));
      });
      return waypoints;
    };
  }
  if (window.jQuery) {
    window.jQuery.fn.waypoint = createExtension(window.jQuery);
  }
  if (window.Zepto) {
    window.Zepto.fn.waypoint = createExtension(window.Zepto);
  }
}());