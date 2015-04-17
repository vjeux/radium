jest.dontMock('../resolve-styles.js');

var MouseUpListener = require('../mouse-up-listener.js');
var merge = require('lodash/object/merge');
var resolveStyles = require('../resolve-styles.js');

function genComponent() {
  return {
    setState: jest.genMockFunction().mockImplementation(function(newState) {
      this.state = merge(this.state, newState);
    }),
    state: {}
  };
}

describe('resolveStyles', function() {

  beforeEach(function() {
    MouseUpListener.subscribe = jest.genMockFunction();
  });

  describe('no-op behavior', function() {

    it('handles null rendered element', function() {
      var component = genComponent();

      var result = resolveStyles(component, null);
    });

    it('doesn\'t explode', function() {
      var component = genComponent();
      var renderedElement = {props: {}};

      var result = resolveStyles(component, renderedElement);

      expect(result).toBe(renderedElement);
      expect(result.props).toBe(renderedElement.props);
    });

    it('passes through normal style objects', function() {
      var component = genComponent();
      var renderedElement = {props: {style: {color: 'blue'}}};

      var result = resolveStyles(component, renderedElement);

      expect(result.props.style).toBe(renderedElement.props.style);
    });

    it('passes through normal style objects of children', function() {
      var component = genComponent();
      var renderedElement = {props: {
        children: [{
          _isReactElement: true,
          props: {style: {color: 'blue'}},
        }]
      }};

      var result = resolveStyles(component, renderedElement);

      expect(result.props.children[0].props.style)
        .toBe(renderedElement.props.children[0].props.style);
    });

    it('ignores invalid children', function() {
      var component = genComponent();
      var renderedElement = {props: {
        children: [{
          props: {style: {color: 'blue'}},
        }]
      }};

      var result = resolveStyles(component, renderedElement);

      expect(result.props.children[0].props.style)
        .toBe(renderedElement.props.children[0].props.style);
    });

  });

  describe('style array', function() {

    it('merges an array of style objects', function() {
      var component = genComponent();
      var renderedElement = {props: {style: [
        {background: 'white'},
        {color: 'blue'},
      ]}};

      var result = resolveStyles(component, renderedElement);

      expect(result.props.style).toEqual({
        background: 'white',
        color: 'blue'
      });
    });

    it('skips falsy and non-object entries', function() {
      var component = genComponent();
      var renderedElement = {props: {style: [
        {background: 'white'},
        false,
        null,
        undefined,
        '',
        [1,2,3],
        {color: 'blue'},
      ]}};

      var result = resolveStyles(component, renderedElement);

      expect(result.props.style).toEqual({
        background: 'white',
        color: 'blue'
      });
    });

    it('overwrites earlier styles with later ones', function() {
      var component = genComponent();
      var renderedElement = {props: {style: [
        {background: 'white'},
        {background: 'blue'},
      ]}};

      var result = resolveStyles(component, renderedElement);

      expect(result.props.style).toEqual({
        background: 'blue'
      });
    });

    it('merges nested special styles', function() {
      var component = genComponent();
      var getRenderedElement = function() {
        return {props: {style: [
          {':hover': { background: 'white'}},
          {':hover': {color: 'blue'}},
        ]}};
      };

      var result = resolveStyles(component, getRenderedElement());
      result.props.onMouseEnter();
      result = resolveStyles(component, getRenderedElement());

      expect(result.props.style).toEqual({
        background: 'white',
        color: 'blue'
      });
    });

  });

  describe(':hover', function() {
    createPseduoStyleTests('hover', 'onMouseEnter', 'onMouseLeave');
  });

  describe(':focus', function() {
    createPseduoStyleTests('focus', 'onFocus', 'onBlur');
  });

  describe(':active', function() {
    createPseduoStyleTests('active', 'onMouseDown');

    it('subscribes to mouse up listener', function() {
      var component = genComponent();
      var renderedElement = {props: {style: {
        ':active': {background: 'red'}
      }}};

      var result = resolveStyles(component, renderedElement);

      expect(MouseUpListener.subscribe).toBeCalled();
    });

    it('adds active styles on mouse down', function() {
      var component = genComponent();
      var style = {
        background: 'blue',
        ':active': {background: 'red'}
      };

      var result = resolveStyles(component, {props: {style: style}});
      expect(result.props.style.background).toEqual('blue');

      result.props.onMouseDown();

      // Must create a new renderedElement each time, same as React, since
      // resolveStyles mutates
      result = resolveStyles(component, {props: {style: style}});
      expect(result.props.style.background).toEqual('red');
    });

    it('removes active styles on mouse up', function() {
      var component = genComponent();
      var style = {
        background: 'blue',
        ':active': {background: 'red'}
      };

      var result = resolveStyles(component, {props: {style: style}});

      result.props.onMouseDown();

      result = resolveStyles(component, {props: {style: style}});
      expect(result.props.style.background).toEqual('red');

      // tigger global mouseup handler
      MouseUpListener.subscribe.mock.calls[0][0]();

      result = resolveStyles(component, {props: {style: style}});
      expect(result.props.style.background).toEqual('blue');
    });

    it('ignores mouse up if no active styles', function() {
      var component = genComponent();
      var style = {
        background: 'blue',
        ':active': {background: 'red'}
      };

      var result = resolveStyles(component, {props: {style: style}});

      result.props.onMouseDown();

      // tigger global mouseup handler
      MouseUpListener.subscribe.mock.calls[0][0]();
      MouseUpListener.subscribe.mock.calls[0][0]();

      result = resolveStyles(component, {props: {style: style}});
      expect(result.props.style.background).toEqual('blue');
    });

    it('calls existing onMouseDown handler', function() {
      var component = genComponent();
      var style = {
        background: 'blue',
        ':active': {background: 'red'}
      };

      var originalOnMouseDown = jest.genMockFunction();

      var result = resolveStyles(
        component,
        {
          props: {
            onMouseDown: originalOnMouseDown,
            style: style
          }
        }
      );

      result.props.onMouseDown();

      expect(originalOnMouseDown).toBeCalled();

      result = resolveStyles(component, {props: {style: style}});
      expect(result.props.style.background).toEqual('red');
    });
  });

  function createPseduoStyleTests(pseudo, onHandlerName, offHandlerName) {

    it('strips special styles if not applied', function() {
      var component = genComponent();
      var style = {background: 'blue'};
      style[':' + pseudo] = {background: 'red'};

      var result = resolveStyles(component, {props: {style: style}});

      expect(result.props.style).toEqual({background: 'blue'});
    });

    it('adds appropriate handlers for ' + pseudo + ' styles', function() {
      var component = genComponent();
      var style = {background: 'blue'};
      style[':' + pseudo] = {background: 'red'};

      var result = resolveStyles(component, {props: {style: style}});

      expect(typeof result.props[onHandlerName]).toBe('function');
      if (offHandlerName) {
        expect(typeof result.props[offHandlerName]).toBe('function');
      }
    });

    it('adds ' + pseudo + ' styles ' + onHandlerName, function() {
      var component = genComponent();
      var style = {background: 'blue'};
      style[':' + pseudo] = {background: 'red'};

      var result = resolveStyles(component, {props: {style: style}});
      expect(result.props.style.background).toEqual('blue');

      result.props[onHandlerName]();

      expect(component.setState).toBeCalled();

      // Must create a new renderedElement each time, same as React, since
      // resolveStyles mutates
      result = resolveStyles(component, {props: {style: style}});
      expect(result.props.style.background).toEqual('red');
    });

    it('throws if multiple elements have the same key', function() {
      var component = genComponent();
      var style = {background: 'blue'};
      style[':' + pseudo] = {background: 'red'};

      var getRenderedElement = function() {
        return {props: {children: [
          {_isReactElement: true, key: 'foo', props: {style: style}},
          {_isReactElement: true, key: 'foo', props: {style: style}},
        ]}};
      };

      expect(function() {
        resolveStyles(component, getRenderedElement());
      }).toThrow();
    });

    it('throws if multiple elements have no key', function() {
      var component = genComponent();
      var style = {background: 'blue'};
      style[':' + pseudo] = {background: 'red'};

      var getRenderedElement = function() {
        return {props: {children: [
          {_isReactElement: true, props: {style: style}},
          {_isReactElement: true, props: {style: style}},
        ]}};
      };

      expect(function() {
        resolveStyles(component, getRenderedElement());
      }).toThrow();
    });

    it('adds ' + pseudo + ' styles to correct element by key', function() {
      var component = genComponent();
      var style = {background: 'blue'};
      style[':' + pseudo] = {background: 'red'};

      var getRenderedElement = function() {
        return {props: {children: [
          {_isReactElement: true, key: 'foo', props: {}},
          {_isReactElement: true, key: 'bar', props: {style: style}},
        ]}};
      };

      var result = resolveStyles(component, getRenderedElement());
      expect(result.props.children[0].props.style).toEqual(null);
      expect(result.props.children[1].props.style.background).toEqual('blue');

      result.props.children[1].props[onHandlerName]();

      result = resolveStyles(component, getRenderedElement());
      expect(result.props.children[0].props.style).toEqual(null);
      expect(result.props.children[1].props.style.background).toEqual('red');
    });

    it('adds ' + pseudo + ' styles to correct element by ref', function() {
      var component = genComponent();
      var style = {background: 'blue'};
      style[':' + pseudo] = {background: 'red'};

      var getRenderedElement = function() {
        return {props: {children: [
          {_isReactElement: true, ref: 'foo', props: {}},
          {_isReactElement: true, ref: 'bar', props: {style: style}},
        ]}};
      };

      var result = resolveStyles(component, getRenderedElement());
      expect(result.props.children[0].props.style).toEqual(null);
      expect(result.props.children[1].props.style.background).toEqual('blue');

      result.props.children[1].props[onHandlerName]();

      result = resolveStyles(component, getRenderedElement());
      expect(result.props.children[0].props.style).toEqual(null);
      expect(result.props.children[1].props.style.background).toEqual('red');
    });

    if (offHandlerName) {
      it('removes ' + pseudo + ' styles ' + offHandlerName, function() {
        var component = genComponent();
        var style = {background: 'blue'};
        style[':' + pseudo] = {background: 'red'};

        var result = resolveStyles(component, {props: {style: style}});

        result.props[onHandlerName]();

        result = resolveStyles(component, {props: {style: style}});
        expect(result.props.style.background).toEqual('red');

        result.props[offHandlerName]();

        expect(component.setState).toBeCalled();

        result = resolveStyles(component, {props: {style: style}});
        expect(result.props.style.background).toEqual('blue');
      });
    }

    it('calls existing ' + onHandlerName + ' handler', function() {
      var component = genComponent();
      var originalOnHandler = jest.genMockFunction();

      var style = {background: 'blue'};
      style[':' + pseudo] = {background: 'red'};

      var renderedElement = {props: {style: style}};
      renderedElement.props[onHandlerName] = originalOnHandler;

      var result = resolveStyles(component, renderedElement);

      result.props[onHandlerName]();

      expect(originalOnHandler).toBeCalled();

      result = resolveStyles(component, {props: {style: style}});
      expect(result.props.style.background).toEqual('red');
    });

    if (offHandlerName) {
      it('calls existing ' + offHandlerName + ' handler', function() {
        var component = genComponent();
        var originalOffHandler = jest.genMockFunction();

        var style = {background: 'blue'};
        style[':' + pseudo] = {background: 'red'};
        style[offHandlerName] = originalOffHandler;

        var renderedElement = {props: {style: style}};
        renderedElement.props[offHandlerName] = originalOffHandler;

        var result = resolveStyles(component, renderedElement);

        result.props[onHandlerName]();
        result.props[offHandlerName]();

        expect(originalOffHandler).toBeCalled();

        result = resolveStyles(component, {props: {style: style}});
        expect(result.props.style.background).toEqual('blue');
      });
    }

  }

  describe('media queries', function() {
    beforeEach(function() {
      resolveStyles.__clearStateForTests();
    });

    it('listens for media queries', function() {
      var component = genComponent();
      var addListener = jest.genMockFunction();
      window.matchMedia = jest.genMockFunction().mockImplementation(function() {
        return {addListener: addListener};
      });

      var getRenderedElement = function() {
        return {props: {style: {
          '(max-width: 400px)': {background: 'red'}
        }}};
      };

      var result = resolveStyles(component, getRenderedElement());
      expect(window.matchMedia).lastCalledWith('(max-width: 400px)');
      expect(addListener).lastCalledWith(jasmine.any('function'));
    });

    it('only listens once for a single element', function() {
      var component = genComponent();
      var addListener = jest.genMockFunction();
      window.matchMedia = jest.genMockFunction().mockImplementation(function() {
        return {addListener: addListener};
      });

      var getRenderedElement = function() {
        return {props: {style: {
          '(max-width: 400px)': {background: 'red'}
        }}};
      };

      resolveStyles(component, getRenderedElement());
      resolveStyles(component, getRenderedElement());

      expect(window.matchMedia.mock.calls.length).toBe(1);
      expect(addListener.mock.calls.length).toBe(1);
    });

    it('listens once per component', function() {
      var component1 = genComponent();
      var component2 = genComponent();
      var addListener = jest.genMockFunction();
      window.matchMedia = jest.genMockFunction().mockImplementation(function() {
        return {addListener: addListener};
      });

      var getRenderedElement = function() {
        return {props: {children: [
          {
            _isReactElement: true,
            key: 'first',
            props: {style: {'(max-width: 400px)': {background: 'red'}}}
          },
          {
            _isReactElement: true,
            key: 'second',
            props: {style: {'(max-width: 400px)': {background: 'red'}}}
          },
        ]}};
      };

      resolveStyles(component1, getRenderedElement());
      resolveStyles(component2, getRenderedElement());

      expect(window.matchMedia.mock.calls.length).toBe(1);
      expect(addListener.mock.calls.length).toBe(2);
    });

    it('applies styles when media query matches', function() {
      var component = genComponent();
      var addListener = jest.genMockFunction();
      window.matchMedia = jest.genMockFunction().mockImplementation(function() {
        return {
          addListener: addListener,
          matches: true,
        };
      });

      var getRenderedElement = function() {
        return {props: {style: {
          background: 'blue',
          '(max-width: 400px)': {background: 'red'}
        }}};
      };

      var result = resolveStyles(component, getRenderedElement());
      expect(result.props.style.background).toEqual('red');
    });

    it('calls component setState when media query changes', function() {
      var component1 = genComponent();
      var component2 = genComponent();
      var listeners = [];
      var addListener = jest.genMockFunction().mockImplementation(
        function(listener) {
          listeners.push(listener);
        }
      );
      var mql = {addListener: addListener};
      window.matchMedia = jest.genMockFunction().mockImplementation(function() {
        return mql;
      });

      var getRenderedElement = function() {
        return {props: {style: {
          background: 'blue',
          '(max-width: 400px)': {background: 'red'}
        }}};
      };

      resolveStyles(component1, getRenderedElement());
      resolveStyles(component2, getRenderedElement());

      listeners.forEach(function(listener) { listener(mql); });

      expect(component1.setState).toBeCalled();
      expect(component2.setState).toBeCalled();
    });

    it('saves listeners on component for later removal', function() {
      var component = genComponent();
      var mql = {
        addListener: jest.genMockFunction(),
        removeListener: jest.genMockFunction(),
      };
      window.matchMedia = jest.genMockFunction().mockImplementation(function() {
        return mql;
      });

      var getRenderedElement = function() {
        return {props: {style: {
          background: 'blue',
          '(max-width: 400px)': {background: 'red'}
        }}};
      };

      resolveStyles(component, getRenderedElement());

      Object.keys(component._radiumMediaQueryListenersByQuery).forEach(
        function(key) {
          component._radiumMediaQueryListenersByQuery[key].remove();
        }
      );

      expect(mql.removeListener).toBeCalled();
    });
  });

});