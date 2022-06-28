// 对 mapState 进行参数处理再执行
export const mapState = normalizeNamespace((namespace, states) => {
    const res = {}
    normalizeMap(states).forEach(({ key, val }) => {
        res[key] = function () {
            let state = this.$store.state
            let getters = this.$store.getters
            // 如果指定了命名空间, 则从相应的模块上下文中找对应的变量 
            if (namespace) {
                const module = getModuleByNamespace(this.$store, 'mapState', namespace)
                if (!module) {
                    return
                }
                state = module.context.state
                getters = module.context.getters
            }
            // 如果是传入的是函数, 则调用函数, 否则直接返回相应的值
            // 1. mapState({ xxx: store => store.state.xxx })
            // 2. mapState(['xxx'])
            return typeof val === 'function'
                ? val.call(this, state, getters)
                : state[val]
        }
        res[key].vuex = true
    })
    return res
})

// 对 mapMutations 进行参数处理再执行
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
        // 将变量进行处理, this.$store.getters 存的是一个 map, 有命名空间则 key 为 namespace/xxx
        // 根据 key 来获取相应的值 
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

// 与 mapMutations 类似
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

// 将数据转化为 map, 格式为 { key, val }
// (1) 参数为数组: mapState(['xxx'])
// (2) 参数为对象: mapState({ xxx: store => store.state.xxx })
function normalizeMap(map) {
    return Array.isArray(map)
        ? map.map(key => ({ key, val: key }))
        : Object.keys(map).map(key => ({ key, val: map[key] }))
}

// 对参数和 namespace 进行处理
// (1) 不带命名空间: mapState([])
// (2) 带命名空间: mapState('namespace', []), 对命名空间进行处理,保持 namespace/ 的格式
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

// 根据命名空间获取相应的模块
function getModuleByNamespace(store, helper, namespace) {
    const module = store._modulesNameSpaceMap[namespace]

    if (!module) {
        console.error(`[vuex] module namespace not found in ${helper}(): ${namespace}`)
    }

    return module
}
