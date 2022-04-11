import View from './components/view'
import Link from './components/link'

export let _Vue   // 用来避免将 Vue 作为依赖打包进来

export function install (Vue) {
  if (install.installed && _Vue === Vue) return   // 避免重复安装
  install.installed = true

  _Vue = Vue      // 保留 Vue 引用

  const isDef = v => v !== undefined

  // 为 router-view 组件 关联 路由组件
  const registerInstance = (vm, callVal) => {
    let i = vm.$options._parentVnode
    /**
     * 调用 vm.$options._parentVnode.data.registerRouteInstance 方法
     * 而这个方法只在 router-view 组件中存在
     * 所以, 如果 vm 的父节点为 router-view, 则为 router-view 关联当前 vm, 即将当前 vm 作为 router-view 的路由组件
     */
    if (isDef(i) && isDef(i = i.data) && isDef(i = i.registerRouteInstance)) {
      i(vm, callVal)
    }
  }

  // 全局混入
  Vue.mixin({
    beforeCreate () {
      // this === new Vue({router: router}) === Vue 根实例

      // 判断是否使用了 vue-router 插件
      if (isDef(this.$options.router)) {
        // 在 Vue 根实例上保存一些信息

        // 保存挂载 VueRouter 的 Vue 实例, 此处为 根实例
        this._routerRoot = this
        // 保存 VueRouter 实例, this.$options.router 仅存在于 Vue 根实例上, 其它 Vue 组件不包含此属性, 所以下面的初始化, 只会执行一次 
        this._router = this.$options.router
        // 初始化 VueRouter 实例, 并传入 Vue 根实例
        this._router.init(this)
        // 响应式定义 _rorte 属性, 保证 _route 发生变化时, 组件(router-view) 会重新渲染
        Vue.util.defineReactive(this, '_route', this._router.history.current)
      } else {
        // 回溯查找 _routerRoot
        this._routerRoot = (this.$parent && this.$parent._routerRoot) || this
      }

      // 为 router-view 组件关联路由组件
      registerInstance(this, this)
    },
    destroyed () {
      // destroyed hook 触发时, 取消 router-view 和 路由组件的关联
      registerInstance(this)
    }
  })

  // 在 Vue.prototype 上注入 $router, $route, 方便快捷访问
  Object.defineProperty(Vue.prototype, '$router', {
    get () { return this._routerRoot._router }
  })

  Object.defineProperty(Vue.prototype, '$route', {
    get () { return this._routerRoot._route }
  })

  // 注册全局组件
  Vue.component('RouterView', View)
  Vue.component('RouterLink', Link)

  const strats = Vue.config.optionMergeStrategies
  // use the same hook merging strategy for route hooks
  // 对路由钩子使用相同的钩子合并策略
  strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created
}
