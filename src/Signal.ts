type Context = any;

/**
 * A 'library' of common aggregators.
 *
 * Pass one of these functions to a `Signal[n]` constructor to add the described behaviour to that signal.
 */
export class Aggregators {
    /**
     * Basic "pass-through" aggregator. Will pass an array of values back to the signal emitter, one per callback.
     *
     * Note that this means the size of the returned array depends on the number of listeners attached.
     */
    public static ARRAY<T>(items: T[]): T[] {
        return items;
    }

    /**
     * If a signal allows listeners to return a promise, this aggregator will await all the received promises and then
     * return an array of the resolved values.
     *
     * This aggregator is intended for use with non-void promises, where the value returned by the promise is
     * meaningful. If the return value of the promise is not significant, consider {@link AwaitVoid}.
     */
    public static AWAIT<T>(items: Promise<T>[]): Promise<T[]> {
        return Promise.all(items);
    }

    /**
     * An aggregator for use with Promise<void> signals. Will await all promises that are returned by callback
     * functions, but discard the (void) return values.
     */
    public static async AWAIT_VOID(items: Promise<void>[]): Promise<void> {
        await Promise.all(items);
    }
}

/**
 * Signature for an aggregator function.
 *
 * On signals that allow callbacks to return a value (i.e. where `R != void`), an aggregator can be used to determine
 * how the values returned by the signal callbacks are returned back to the code that emitted the signal.
 *
 * If no aggregator is provided, the `emit()` function on a signal has a `void` return type.
 */
export type Aggregator<R, R2> = (items: R[]) => R2;

/**
 * Represents a slot that exists on a signal.
 */
export interface SignalSlot<T extends Function = Function> {
    callback: T;
    context: Context;

    /**
     * Removes 'callback' from the signal to which this slot is registered.
     *
     * Will have no effect if callback has already been removed (regardless of how the slot was removed).
     */
    remove(): void;
}

/**
 * Signal implementation, a messaging paradigm similar to standard JavaScript events, only more object-based.
 *
 * Create a signal for each event type, specifying the types of any callback parameters. Listeners (known as "slots")
 * can then be added to (and removed from) the signal.
 *
 * Unlike events, callbacks are also able to return a value. To make use of these return values, pass an aggregator
 * function when defining the signal. The static functions within {@link Aggregators} are a set of aggregators that
 * cover typical use-cases.
 */
export class Signal<A extends any[], R = void, R2 = R> {
    private _slots: SignalSlot[];

    private aggregator: Aggregator<R, R2> | null;

    constructor(aggregator?: Aggregator<R, R2>) {
        this._slots = [];
        this.aggregator = aggregator || null;
    }

    /**
     * Provides read-only access to the current set of slots.
     *
     * This is an array of all callbacks that are currently attached to this signal.
     */
    public get slots(): ReadonlyArray<SignalSlot> {
        return this._slots;
    }

    public add(callback: (...args: A) => R, context?: Context): SignalSlot<(...args: A) => R> {
        const slot = {callback, context, remove: () => this.removeSlot(slot)};
        this._slots.push(slot);
        return slot;
    }

    public remove(callback: (...args: A) => R, context?: Context): boolean {
        const index: number = this._slots.findIndex((ctx) => ctx.callback === callback && ctx.context === context);

        if (index >= 0) {
            this._slots.splice(index, 1);
            return true;
        } else {
            return false;
        }
    }

    public has(callback: (...args: A) => R, context?: Context): boolean {
        return this._slots.findIndex((ctx) => ctx.callback === callback && ctx.context === context) >= 0;
    }

    public emit(...args: A): R2 {
        const slots = this._slots.slice();  // Clone array, in case a callback modifies this signal

        if (!this.aggregator) {
            slots.forEach(slot => slot.callback.apply(slot.context, args));

            // If not using an aggregator, return type should be void.
            // No way to enforce this through TypeScript without creating a whole new set of signal classes, so relying on convention here.
            return (undefined as unknown) as R2;
        } else {
            return this.aggregator(slots.map(slot => slot.callback.apply(slot.context, args)));
        }
    }

    private removeSlot(slot: SignalSlot): void {
        const index: number = this._slots.indexOf(slot);

        if (index >= 0) {
            this._slots.splice(index, 1);
        }
    }
}
