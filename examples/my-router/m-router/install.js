import myView from './component/view'

let _Vue
export function install(Vue) {
    console.log('触发了 install', Vue)
    _Vue = Vue
    // 使用 Vue.mixin 混入每一个组件
    Vue.mixin({
        beforeCreate() {
            // 如果是根组件
            if (this.$options.router) {
                // this 是根组件本身
                this._routerRoot = this

                // 将 VueRouter 挂载到根组件的实例上
                this._router = this.$options.router
                // 执行 VueRouter 实例上的 init 方法, 初始化
                this._router.init(this)
                Vue.util.defineReactive(this, '_route', this._router.history.current)
            } else {
                // 非根组件, 也要把父组件的 _routerRoot 保存到自身身上
                this._routerRoot = (this.$parent && this.$parent._routerRoot) || this
            }
        }
    })
    
    Object.defineProperty(Vue.prototype, '$router', {
        get () { return this._routerRoot._router}
    })
    
    Object.defineProperty(Vue.prototype, '$route', {
        get () { return this._routerRoot._route}
    })

    Vue.component('router-link', {
        props: {
            to: String
        },
        render(h) {
            let mode = this._self._routerRoot._router.mode
            console.log(this.to)
            let to = mode === 'hash' ? '/my-router/#' + this.to : '/my-router' + this.to
            return h('a', {attrs: { href: to } }, this.$slots.default)
        }
    })

    Vue.component('v-view', myView)
}