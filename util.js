export function forEach(obj, fn) {
    Object.keys(obj).forEach(key => fn(obj[key], key))
}

export function isPromise(val) {
    return val && typeof val.then === 'function'
}

export function partial(fn, arg) {
    return function () {
        return fn(arg)
    }
}