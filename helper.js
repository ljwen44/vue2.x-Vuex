
// ...mapState('namespace', [])
export const mapState = normalizeNamespace((namespace, states) => {
    const res = {}
    normalizeMap(states).forEach(({ key, val }) => {
        res[key] = function () {
            let state = this.$store.state
            let getters = this.$store.getters
            if (namespace) {
                const module = getModuleByNamespace(this.$store, 'mapState', namespace)
                if (!module) {
                    return
                }
                state = module.context.state
                getters = module.context.getters
            }
            return typeof val === 'function'
                ? val.call(this, state, getters)
                : state[val]
        }
        res[key].vuex = true
    })
    return res
})

export const mapMutations = normalizeNamespace((namespace, mutations) => {
    const res = {}
    normalizeMap(mutations).forEach(({ key, val }) => {
        res[key] = function (...args) {
            let commit = this.$store.commit
            if (namespace) {
                const module = getModuleByNamespace(this.$store, 'mapMutations', namespace)
                if (!module) {
                    return
                }
                commit = module.context.commit
            }
            return typeof val === 'function'
                ? val.apply(this, [commit].concat(args))
                : commit.apply(this.$store, [val].concat(args))
        }
    })
    return res
})

export const mapGetters = normalizeNamespace((namespace, getters) => {
    const res = {}
    normalizeMap(getters).forEach(({ key, val }) => {
        val = namespace + val
        res[key] = function () {
            if (namespace && !getModuleByNamespace(this.$store, 'mapGetters', namespace)) {
                return
            }
            if (!val in this.$store.getters) {
                console.error(`[vuex] unknown getter: ${val}`)
                return
            }
            return this.$store.getters[val]
        }
        res[key].vuex = true
    })
    return res
})

export const mapActions = normalizeNamespace((namespace, actions) => {
    const res = {}
    normalizeMap(actions).forEach(({ key, val }) => {
        res[key] = function (...args) {
            let dispatch = this.$store.dispatch
            if (namespace) {
                const module = getModuleByNamespace(this.$store, 'mapActions', namespace)
                if (!module) {
                    return
                }
                dispatch = module.context.dispatch
            }
            return typeof val === 'function'
                ? val.apply(this, [dispatch].concat(args))
                : dispatch.apply(this.$store, [val].concat(args))
        }
    })
    return res
})


function normalizeMap(map) {
    return Array.isArray(map)
        ? map.map(key => ({ key, val: key }))
        : Object.keys(map).map(key => ({ key, val: map[key] }))
}


function normalizeNamespace(fn) {
    return (namespace, map) => {
        if (typeof namespace !== 'string') {
            map = namespace
            namespace = ''
        } else if (namespace.charAt(namespace.length - 1) !== '/') {
            namespace += '/'
        }
        return fn(namespace, map)
    }
}

function getModuleByNamespace(store, helper, namespace) {
    const module = store._modulesNameSpaceMap[namespace]

    if (!module) {
        console.error(`[vuex] module namespace not found in ${helper}(): ${namespace}`)
    }

    return module
}
