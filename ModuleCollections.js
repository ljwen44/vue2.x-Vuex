import Module from './Module'
import { forEach } from './util'

export default class ModuleCollection {
    constructor(rawRootModule) {
        this.register([], rawRootModule, false)
    }

    get(path) {
        return path.reduce((module, key) => {
            return module.getChild(key)
        }, this.root)
    }

    // 注册模块
    register(path, rawModule, runtime = true) {
        const newModule = new Module(rawModule, runtime)
        // 根实例
        if (path.length === 0) {
            this.root = newModule
        } else {
            // 获取父实例
            const parent = this.get(path.slice(0, -1))
            parent.addChild(path[path.length - 1], newModule)
        }

        // 如果有子模块，则递归注册子模块
        if (rawModule.modules) {
            forEach(rawModule.modules, (rawModuleChild, key) => {
                this.register(path.concat(key), rawModuleChild, runtime)
            })
        }
    }

    getNamespace(path) {
        let module = this.root
        return path.reduce((namespace, key) => {
            module = module.getChild(key)
            return namespace + (module.namespaced ? key + '/' : '')
        }, '')
    }

    // 判断是否注册
    isRegistered(path) {
        const parent = this.get(path.slice(0, -1))
        const key = path[path.length - 1]
        if (parent) {
            return parent.hasChilde(key)
        }
        return false
    }
} 