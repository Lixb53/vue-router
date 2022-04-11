import { install } from './install'
import { createMatcher } from './createMatcher'
import HashHistory from './hashHistory'
import HTML5History from './html5History'

class VueRouter {
    constructor(options) {
        // 保存挂载实例
        this.app = null
        // VueRouter 支持多实例
        this.apps = []
        this.options = options
        // 创建路由 matcher 对象, 传入 routes 路由配置列表 及 VueRouter 实例
        this.matcher = createMatcher(options.routes || [], this)
        console.log(this.matcher)

        this.mode = options.mode || 'hash'

        switch (this.mode) {
            case 'hash':
                this.history = new HashHistory(this, options.base)
                break
            case 'history':
                this.history = new HTML5History(this, options.base)
                break
        }
    }

    match (raw, current, redirectedFrom) {
        return this.matcher.match(raw, current, redirectedFrom)
    }

    init(app) {

        const history = this.history

        if (history instanceof HTML5History) {
            console.log('html5history')
        } else if (history instanceof HashHistory) {
            history.listen((route) => app._route = route)
            history.transitionTo(history.getCurrentLocation())
        }
    }
}

VueRouter.install = install

export default VueRouter