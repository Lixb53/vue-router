import { START } from './createMatcher'

export default class History {
    constructor (router, base) {
        // 将传进来的 VueRouter 实例保存
        this.router = router
        // 格式化 base, 保证 base 是以 / 开头
        this.base = normalizeBase(base)

        // 当前指向的 route 对象
        this.current = START
    }

    listen (cb) {
        this.cb = cb
    }

    transitionTo (location) {
        console.log(location)
        console.log(this)
        const route = this.router.match(location, this.current)
        console.log(route)
        this.current = route
        this.cb && this.cb(route)
    }
}

function normalizeBase(base) {
    if (base.charAt(0) !== '/') {
        base = '/' + base
    }

    return base.replace(/\/$/, '')
}