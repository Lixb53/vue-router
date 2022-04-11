// Mathcer 工厂函数
export function createMatcher(routes, router) {
    // 创建路由映射表
    const { pathList, pathMap, nameMap } = createRouteMap(routes)


    function addRoutes (routes) {
        createRouteMap(routes, pathList, pathMap, nameMap)
    }

    function match(raw, currentRoute, redirectedFrom) {
        const location = normalizeLocation(raw, currentRoute, false, router)
        console.log(location)

        const { name } = location

        // 通过 name 匹配
        if (name) {
            const record = nameMap[name]

            if (!record) return createRoute(null, location)
            return createRoute(record, location, redirectedFrom)
        } else if (location.path) {
            const record = pathMap[location.path]
            if (!record) return createRoute(null, location)
            return createRoute(record, location)
        }
    }

    return {
        match,
        addRoutes
    }
}

// 创建路由映射 map, 添加路由记录
export function createRouteMap(routes, oldPathList, oldPathMap, oldNameMap) {
    const pathList = oldPathList || [],
          pathMap = oldPathMap || Object.create(null),
          nameMap = oldNameMap || Object.create(null);
    
    // 遍历路由配置对象, 生成/添加路由记录
    routes.forEach(route => {
        addRouteRecord(pathList, pathMap, nameMap, route)
    })

    return {
        pathList,
        pathMap,
        nameMap
    }
}

// 添加路由记录
export function addRouteRecord(pathList, pathMap, nameMap, route, parent, matchAs) {
    const path = parent ? `${parent.path}/${route.path}` : route.path
    const { name, component, children = null } = route
    const record = {
        path,
        name,
        component,
        parent,
        matchAs
    }

    // 处理子路由
    if (children) {
        // 遍历生成子路由记录
        children.map(child => {
            const childMatchAs = matchAs
                ? cleanPath(`${matchAs}/${child.path}`)
                : undefined
            addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs)
        })
    }
    
    // 若 pathMap 中不存在当前路径, 则更新 pathList 和 pathMap
    if (!pathMap[path]) {
        pathList.push(path)
        pathMap[path] = record
    }

    // 处理别名
    if (route.alias !== undefined) {
        const aliases = Array.isArray(route.alias) ? route.alias : [route.alias]
        for (let i = 0; i < aliases.length; ++i) {
            const alias = aliases[i]
            // alias 的值和 path 不能重复
            if (alias === path) continue
            
            // 生成别名路由配置对象
            const aliasRoute = {
                path: alias,
                children: route.children
            }
            // 添加别名路由记录
            addRouteRecord(
                pathList,
                pathMap,
                nameMap,
                aliasRoute,     // 别名路由
                parent,         // 当前路由的父路由, 因为是给当前路由取了个别名, 所以二者其实是同一个父路由
                record.path || '/',     // matchAs, 用来生成别名路由的子路由
            )
            // !总结: 当前路由设置了 alias 后, 会单独为当前路由及其子路由生成路由记录, 且子路由的 path 前缀为 matchAs(即别名路由的 path)
        }
    }

    // 处理命名路由
    if (name) {
        // 更新 nameMap
        if (!nameMap[name]) {
            nameMap[name] = record
        }
    }
}


export function cleanPath (path) {
    return path.replace(/\/\//g, '/')
}

export function extend (a, b) {
    for (const key in b) {
      a[key] = b[key]
    }
    return a
}

function normalizeLocation(raw, current, append, router) {
    let next = typeof raw === 'string' ? { path: raw } : raw
    if (next._normalized) {
        return next
    } else if (next.name) {
        next = extend({}, raw)
        const params = next.params
        if (params && typeof params === 'object') {
            next.params = extend({}, params)
        }
        return next
    }

    const parsedPath = parsePath(next.path || '')
    const basePath = (current && current.path) || '/'
    const path = parsedPath.path || basePath

    let hash = next.hash || parsedPath.hash
    let query = next.query || parsedPath.query

    return {
        _normalized: true,
        path,
        query,
        hash
    }
}

function parsePath (path) {
    let hash = '',
        query = '';
    
    const hashIndex = path.indexOf('#')
    if (hashIndex >= 0) {
        hash = path.slice(hashIndex)
        path = path.slice(0, hashIndex)
    }

    const queryIndex = path.indexOf('?')
    if (queryIndex >= 0) {
        query = path.slice(queryIndex + 1)
        path = path.slice(0, queryIndex)
    }

    return {
        path,
        query,
        hash
    }
}

function createRoute(record,location) {
    const res = []
    if (record) {
        while(record) {
            res.unshift(record)
            record = parent.record
        }
    }
    return {
        path: location.path || '/',
        hash: location.hash || '',
        name: location.name || (record && record.name),
        meta: (record && record.meta) || {},
        matched: res
    }
}


export const START = createRoute(null, {
    path: '/'
})