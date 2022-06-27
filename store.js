import store from '..'
import ModuleCollection from './ModuleCollections'
import { isPromise, partial, forEach } from './util'
let Vue

export class Store {
    constructor(options = {}) {
        // 严格模式
        this.strict = options.strict || false

        // 提交状态
        this._committing = false
        // 存放 actions 
        this._actions = Object.create(null)
        // 存放 mutations
        this._mutations = Object.create(null)
        // 存放 getters
        this._getters = Object.create(null)
        // 模块对象，包括子模块
        this._modules = new ModuleCollection(options)
        // 命名空间 map
        this._modulesNameSpaceMap = Object.create(null)
        // getter 缓存
        this._localGettersCache = Object.create(null)

        // 绑定 commit 和 dispatch，传入当前实例
        const store = this
        const { commit, dispatch } = this
        this.commit = function (type, payload, options) {
            return commit.call(store, type, payload, options)
        }
        this.dispatch = function (type, payload) {
            return dispatch.call(store, type, payload)
        }

        // 获取根的 state
        const state = this._modules.root.state
        // 安装子模块和模块的 getters
        installModule(this, state, [], this._modules.root)

        resetStoreVM(this, state)
    }

    get state() {
        return this._vm._data.$$state
    }

    commit(type, payload, options) {
        // const mutation = { type, payload }
        const entry = this._mutations[type]
        if (!entry) {
            console.error(`[vuex] unknown mutation type: ${type}`)
            return
        }
        this._withCommit(() => {
            entry.forEach(handler => {
                handler(payload)
            })
        })
    }

    dispatch(type, payload) {
        // const action = { type, payload }
        const entry = this._actions[type]
        if (!entry) {
            console.error(`[vuex] unknown action type: ${type}`)
            return
        }
        const result = entry.length > 1
            ? Promise.all(entry.map(handler => handler(payload)))
            : entry[0](payload)

        return new Promise((resolve, reject) => {
            result.then(res => {
                resolve(res)
            }, err => reject(err))
        })
    }

    _withCommit(fn) {
        const committing = this._committing
        this._committing = true
        fn()
        this._committing = committing
    }

    replaceState(state) {
        this._withCommit(() => {
            this._vm._data.$$state = state
        })
    }

    registerModule(path, rawModule, options = {}) {
        if (typeof path === 'string') {
            path = [path]
        }
        this._modules.register(path, rawModule)
        installModule(this, this.state, path, this._modules.get(path), options.preserveState)
        resetStoreVM(this, this.state)
    }
}

function installModule(store, rootState, path, module) {
    // 判断是否是根
    const isRoot = !path.length
    const namespace = store._modules.getNamespace(path)

    if (module.namespaced) {
        if (store._modulesNameSpaceMap[namespace]) {
            console.error(`[vuex] duplicate namespace ${namespace} for the namespaced module ${path.join('/')}`)
        }
        store._modulesNameSpaceMap[namespace] = module
    }
    if (!isRoot) {
        // 获取嵌套的 state 的父 state
        const parentState = getNestedState(rootState, path.slice(0, -1))
        // 模块名
        const moduleName = path[path.length - 1]
        store._withCommit(() => {
            Vue.set(parentState, moduleName, module.state)
            // parentState[moduleName] = module.state
        })
    }

    const local = module.context = makeLocalContext(store, namespace, path)

    // 注册 mutations actions getters
    module.forEachMutation((mutation, key) => {
        const namespacedType = namespace + key
        registerMutation(store, namespacedType, mutation, local)
    })

    module.forEachAction((action, key) => {
        const type = action.root ? key : namespace + key
        const handler = action.handler || action
        registerAction(store, type, handler, local)
    })

    module.forEachGetter((getter, key) => {
        const namespacedType = namespace + key
        registerGetter(store, namespacedType, getter, local)
    })

    // 如果有子模块，则递归安装子模块
    module.forEachChild((child, key) => {
        installModule(store, rootState, path.concat(key), child)
    })
}

function getNestedState(state, path) {
    return path.reduce((state, key) => {
        return state[key]
    }, state)
}

function makeLocalContext(store, namespace, path) {
    const noNamespace = namespace === ''
    let local = {
        dispatch: noNamespace ? store.dispatch : (type, payload, options) => {
            if (!options || !options.root) {
                type = namespace + type
                if (!store._actions[type]) {
                    console.error(`[vuex] unknown local action type: ${type}, global type: ${type}`)
                    return
                }
            }
            return store.dispatch(type, payload)
        },
        commit: noNamespace ? store.commit : (type, payload, options) => {
            if (!options || !options.root) {
                type = namespace + type
                if (!store._mutations[type]) {
                    console.error(`[vuex] unknown local mutation type: ${type}, global type: ${type}`)
                    return
                }
            }
            store.commit(type, payload, options)
        },
    }
    Object.defineProperties(local, {
        getters: {
            get: noNamespace
                ? () => store.getters
                : () => makeLocalGetters(store, namespace)
        },
        state: {
            get: () => {
                return getNestedState(store.state, path)
            }
        }
    })
    return local
}

function makeLocalGetters(store, namespace) {
    if (!store._localGettersCache[namespace]) {
        const gettersProxy = {}
        const splitPos = namespace.length
        Object.keys(store.getters).forEach(type => {
            if (type.slice(0, splitPos) !== namespace) return

            const localType = type.slice(splitPos)

            Object.defineProperty(gettersProxy, localType, {
                get: () => store.getters[type],
                enumerable: true
            })
        })
        store._localGettersCache[namespace] = gettersProxy
    }

    return store._localGettersCache[namespace]
}

function registerMutation(store, type, handler, local) {
    const entry = store._mutations[type] || (store._mutations[type] = [])
    entry.push(function (payload) {
        handler.call(store, local.state, payload)
    })
}

function registerAction(store, type, handler, local) {
    const entry = store._actions[type] || (store._actions[type] = [])
    entry.push(function (payload) {
        let res = handler.call(store, {
            dispatch: local.dispatch,
            commit: local.commit,
            getters: local.getters,
            state: local.state,
            rootGetters: store.getters,
            rootState: store.state
        }, payload)
        if (!isPromise(res)) {
            res = Promise.resolve(res)
        }
        return res
    })
}

function registerGetter(store, type, rawGetter, local) {
    if (store._getters[type]) {
        console.error(`[vuex] duplicate getter key: ${type}`)
        return
    }
    store._getters[type] = function (store) {
        return rawGetter(
            local.state,
            local.getters,
            store.state,
            store.getters
        )
    }
}

// function resetStore(store) {
//     store._actions = Object.create(null)
//     store._mutations = Object.create(null)
//     store._getters = Object.create(null)
//     store._modulesNameSpaceMap = Object.create(null)
//     const state = store.state
//     installModule(store, state, [], store._modules.root, true)
//     resetStoreVM(store, state)
// }

function resetStoreVM(store, state) {
    const oldVm = store._vm
    store.getters = {}
    const wrappedGetters = store._getters
    const computed = {}
    forEach(wrappedGetters, (fn, key) => {
        computed[key] = partial(fn, store)
        Object.defineProperty(store.getters, key, {
            get: () => store._vm[key],
            enumerable: true
        })
    })
    store._vm = new Vue({
        data: {
            $$state: state
        },
        computed
    })

    if (oldVm) {
        Vue.nextTick(() => oldVm.$destory())
    }
}

export function install(_Vue) {
    if (Vue && Vue === _Vue) {
        return
    }
    Vue = _Vue
    Vue.mixin({
        beforeCreate() {
            const options = this.$options
            if (options.store) {
                this.$store = options.store
            } else if (options.parent && options.parent.$store) {
                this.$store = options.parent.$store
            }
        }
    })
}