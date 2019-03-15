var React = require('react');
var AsyncRenderingCycle = require('./async-rendering-cycle');
var useState = React.useState;
var useEffect = React.useEffect;

// variable used for communicating between wrapper functions and hook functions 
var state;

function Relaks(asyncFunc, areEqual) {
	// create synchronous function wrapper
	var syncFunc = function(props) {
		state = useState({});
		var cycle = AsyncRenderingCycle.get(state);
		if (cycle) {
			if (cycle.hasEnded()) {
				cycle = undefined;
			} else if (!cycle.isRerendering()) {
				// cancel the current cycle
				cycle.cancel();
				cycle = undefined;
			}
		}
		if (!cycle) {
			// start a new cycle
			cycle = AsyncRenderingCycle.start(state, syncFunc, props);

	        if (cycle.isInitial()) {
	            // see if the contents has been seeded
	            var seed = findSeed(syncFunc, props);
	            if (seed) {
	            	cycle.substitute(seed);
	            }
	        }
		}

		// cancel current cycle on unmount
		useEffect(() => {
			return () => { 
				if (!cycle.hasEnded()) {
					cycle.cancel();
				}
			};
		}, [ cycle ]);

		// call async function
		cycle.startSync();
		asyncFunc(props).then(cycle.resolve, cycle.reject);
		cycle.endSync();

        state = undefined;

		// throw error that had occurred in async code
		var error = cycle.getDeferred();
        if (error) {
        	throw error;
        }

        // return either the promised element or progress
		var element = cycle.getPromised() || cycle.getProgress();
        return (element !== undefined) ? element : null;
	};

	// add prop types if available
	if (asyncFunc.propTypes) {
		syncFunc.propTypes = asyncFunc.propTypes;
	}
	// memoize function unless behavior is countermanded
	if (areEqual !== false) {
		syncFunc = React.memo(syncFunc, areEqual);
	}
	// add default props if available
	if (asyncFunc.defaultProps) {
		syncFunc.defaultProps = asyncFunc.defaultProps;
	}
	// set display name
	syncFunc.displayName = asyncFunc.displayName || asyncFunc.name;
	return syncFunc;
}

function useProgress(delayEmpty, delayRendered) {
	// apply default delays
	if (typeof(delayEmpty) !== 'number') {
		delayEmpty = 50;
	}
	if (typeof(delayRendered) !== 'number') {
		delayRendered = Infinity;
	}

	// set delays
	var cycle = AsyncRenderingCycle.get(state);
	cycle.delay(delayEmpty, delayRendered);

	// return functions (bound in constructor)
	return [ cycle.show, cycle.check, cycle.delay ];
}

function useRenderEvent(name, f) {
	var cycle = AsyncRenderingCycle.get(state);
	cycle.on(name, f);
}

function usePreviousProps(asyncCycle) {
	var cycle = AsyncRenderingCycle.get(state);
	return cycle.getPrevProps(asyncCycle);
}

function plant(list) {
    if (!(list instanceof Array)) {
        throw new Error('Seeds must be an array of object. Are you calling harvest() with the options { seeds: true }?');
    }
    seeds = list;
}

var seeds = [];

function findSeed(type, props) {
    var index = -1;
    var best = -1;
    for (var i = 0; i < seeds.length; i++) {
        var seed = seeds[i];
        if (seed.type === type) {
            // the props aren't going to match up exactly due to object
            // recreations; just find the one that is closest
            var count = 0;
            if (props && seed.props) {
                for (var key in props) {
                    if (seed.props[key] === props[key]) {
                        count++;
                    }
                }
            }
            if (count > best) {
                // choose this one
                index = i;
                best = count;
            }
        }
    }
    if (index != -1) {
        var match = seeds[index];
        seeds.splice(index, 1);
        return match.result;
    }
}

module.exports = exports = Relaks;

exports.plant = plant;
exports.useProgress = useProgress;
exports.useRenderEvent = useRenderEvent;
exports.usePreviousProps = usePreviousProps;
