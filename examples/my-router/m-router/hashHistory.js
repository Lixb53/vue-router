import History from './history'
export default class HashHistory extends History {
    constructor (router, base) {
        super(router, base)

        // 确保 url 是以 / 开头的
        ensureSlash()

        this.setupHashLister()
    }

    // 监听 hash 的变化
    setupHashLister() {
        window.addEventListener('hashchange', () => {
            // 传入当前 url 的 hash, 并触发跳转
            if (!ensureSlash()) {
                return
            }
            
            this.transitionTo(getHash())
        })
    }

    getCurrentLocation() {
        return getHash()
    }
}

function ensureSlash() {
    const path = getHash()

    if (path.charAt(0) === '/') {
        return true
    }
    replaceHash('/' + path)
    return false
}

export function getHash() {
    let href = window.location.href
    const index = href.indexOf('#')

    if (index < 0) return ''

    href = href.slice(index + 1)

    const searchIndex = href.indexOf('?')
    if (searchIndex < 0) {
        const hashIndex = href.indexOf('#')
        if (hashIndex > -1) {
            href = decodeURI(href.slice(0, hashIndex)) + href.slice(hashIndex)
        } else href = decodeURI(href)
    } else {
        href = decodeURI(href.slice(0, searchIndex)) + href.slice(searchIndex)
    }

    return href
}

function getUrl(path) {
    const href = window.location.href
    const i = href.indexOf('#')
    const base = i >= 0 ? href.slice(0, i) : href
    return `${base}#${path}`
}

// 替换 hash 记录
function replaceHash (path) {
    window.location.replace(getUrl(path))
}