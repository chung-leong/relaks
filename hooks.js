import React, { useState, useRef, useMemo, useEffect, useCallback, useDebugValue } from 'react';
import { AsyncRenderingCycle } from './async-rendering-cycle';

function use(asyncFunc) {
	// create synchronous function wrapper
	var syncFunc = function(props, ref) {
		var state = useState({});
		var target = { func: syncFunc, props };
		var options = { showProgress: true, performCheck: true };
		var cycle = AsyncRenderingCycle.acquire(state, target, options);

		// cancel current cycle on unmount
		useEffect(function() {
			cycle.mount();
			return function() {
				if (!cycle.hasEnded()) {
					cycle.cancel();
				}
			};
		}, [ cycle ]);

		// call async function
		cycle.run(function() {
			return asyncFunc(props, ref);
		});

        AsyncRenderingCycle.release();

		// throw error that had occurred in async code
		var error = cycle.getError();
        if (error) {
        	throw error;
        }

        // return either the promised element or progress
		var element = cycle.getElement();
        return element;

	};

	// attach async function (that returns a promise to the final result)
	syncFunc.renderAsyncEx = function(props) {
		var state = [ {}, function(v) {} ];
		var target = { func: syncFunc, props };
		var options = { performCheck: true };
		var cycle = AsyncRenderingCycle.acquire(state, target, options);
		var promise = asyncFunc(props);
		AsyncRenderingCycle.release();
		if (promise && typeof(promise.then) === 'function') {
			return promise.then(function(element) {
				if (element === undefined) {
					element = cycle.progressElement;
				}
				return element;
			});
		} else {
			return promise;
		}
	};

	// add prop types if available
	if (asyncFunc.propTypes) {
		syncFunc.propTypes = asyncFunc.propTypes;
	}
	// add default props if available
	if (asyncFunc.defaultProps) {
		syncFunc.defaultProps = asyncFunc.defaultProps;
	}
	// set display name
	syncFunc.displayName = asyncFunc.displayName || asyncFunc.name;
	return syncFunc;
}

function memo(asyncFunc, areEqual) {
	var syncFunc = use(asyncFunc);
	return React.memo(syncFunc, areEqual);
}

function forwardRef(asyncFunc, areEqual) {
	var syncFunc = use(asyncFunc);
	return React.memo(React.forwardRef(syncFunc), areEqual);
}

function useProgress(delayEmpty, delayRendered) {
	// set delays
	var cycle = AsyncRenderingCycle.need();
	cycle.delay(delayEmpty, delayRendered, true);

	// return functions (bound in constructor)
	return [ cycle.show, cycle.check, cycle.delay ];
}

function useRenderEvent(name, f) {
	var cycle = AsyncRenderingCycle.need();
	cycle.on(name, f);
}

function usePreviousProps(asyncCycle) {
	var cycle = AsyncRenderingCycle.need();
	return cycle.getPrevProps(asyncCycle);
}

function useEventTime() {
	var state = useState();
	var date = state[0];
	var setDate = state[1];
	var callback = useCallback(function(evt) {
		setDate(new Date);
	});
	useDebugValue(date);
	return [ date, callback ];
}

function useListener(f) {
	var ref = useRef({});
	if (!AsyncRenderingCycle.skip()) {
		ref.current.f = f;
	}
	useDebugValue(f);
	return useCallback(function () {
		ref.current.f.apply(null, arguments);
	}, []);
}

function useAsyncEffect(f, deps) {
	useEffect(function() {
		var cleanup;
		var unmounted = false;
		var promise = f();
		Promise.resolve(promise).then(function(ret) {
			cleanup = ret;
			if (unmounted) {
				cleanup();
			}
		});
		return function() {
			unmounted = true;
			if (cleanup) {
				cleanup();
			}
		};
	}, deps);
	useDebugValue(f);
}

function useErrorCatcher(rethrow) {
	var [ error, setError ] = useState();
	if (rethrow && error) {
		throw error;
	}
	var run = useCallback(function(f) {
		try {
			var promise = f();
			if (promise && promise.catch instanceof Function) {
				promise = promise.catch(function(err) {
					setError(err);
				});
			}
			return promise;
		} catch (err) {
			setError(err);
		}
	});
	useDebugValue(error);
	return [ error, run ];
}

function usePrevious(value) {
	var ref = useRef();
  	useEffect(function() {
		ref.current = value;
	}, [ value ]);
  	return ref.current;
}

function useComputed(f, deps) {
	var pair = useState({});
	var state = pair[0];
	var setState = pair[1];
	if (deps instanceof Array) {
		deps = deps.concat(state);
	} else {
		deps = [ state ];
	}
	var value = useMemo(function() {
		return (state.current = f(state.current));
	}, deps);
	var recalc = useCallback(function() {
		setState({ value: state.value });
	}, []);
	return [ value, recalc ];
}

export {
	use,
	memo,
	forwardRef,

	useProgress,
	useRenderEvent,
	usePreviousProps,
	useEventTime,
	useListener,
	useAsyncEffect,
	useErrorCatcher,
	usePrevious,
	useComputed,
};
