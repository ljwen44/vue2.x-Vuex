import { forEach } from './util'

export default class Module {
    constructor(rawModule, runtime) {
        this.runtime = runtime
        // 子模块
        this._children = Object.create(null)
        // 原始数据
        this._rawModule = rawModule
        // 根 state
        const rawState = rawModule.state
        this.state = (typeof rawState === 'function' ? rawState() : rawState) || {}
    }
    get namespaced() {
        return !!this._rawModule.namespaced
    }
    // 添加子模块
    addChild(key, module) {
        this._children[key] = module
    }
    // 移除子模块
    removeChild(key) {
        delete this._children[key]
    }
    // 获取子模块
    getChild(key) {
        return this._children[key]
    }
    // 判断是否有某子模块
    hasChild(key) {
        return key in this._children
    }
    // 更新模块
    update(rawModule) {
        this._rawModule.namespaced = rawModule.namespaced
        if (rawModule.mutations) {
            this._rawModule.mutations = rawModule.mutations
        }
        if (rawModule.actions) {
            this._rawModule.actions = rawModule.actions
        }
        if (rawModule.getters) {
            this._rawModule.getters = rawModule.getters
        }
    }
    // 遍历子模块
    forEachChild(fn) {
        forEach(this._children, fn)
    }
    // 遍历 mutations
    forEachMutation(fn) {
        if (this._rawModule.mutations) {
            forEach(this._rawModule.mutations, fn)
        }
    }
    // 遍历 actions
    forEachAction(fn) {
        if (this._rawModule.actions) {
            forEach(this._rawModule.actions, fn)
        }
    }
    // 遍历 getters
    forEachGetter(fn) {
        if (this._rawModule.getters) {
            forEach(this._rawModule.getters, fn)
        }
    }
}