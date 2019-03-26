import { get, set, plant } from './options';
import { use, memo } from './hooks';

export default {
	get: get,
	set: set,
	plant: plant,
};

export * from './options';
export * from './class-preact';
export * from './async-rendering-cycle';
export * from './async-rendering-interrupted';
