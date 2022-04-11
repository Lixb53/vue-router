import Vue, { ComponentOptions, PluginFunction, AsyncComponent } from 'vue'

type Component = ComponentOptions<Vue> | typeof Vue | AsyncComponent
type Dictionary < T > = { [key: string]: T }
type ErrorHandler = (err: Error) => void

export type RouterMode = 'hash' | 'history' | 'abstract'
export type RawLocation = string | Location
export type RedirectOption = RawLocation | ((to: Route) => RawLocation)
export type NavigationGuard < V extends Vue = Vue > = (
  to: Route,
  from: Route,
  next: (to?: RawLocation | false | ((vm: V) => any) | void) => void
) => any

export declare class VueRouter {
  constructor(options?: RouterOptions)

  app: Vue
  mode: RouterMode
  currentRoute: Route

  beforeEach(guard: NavigationGuard): Function
  beforeResolve(guard: NavigationGuard): Function
  afterEach(hook: (to: Route, from: Route) => any): Function
  push(location: RawLocation): Promise<Route>
  replace(location: RawLocation): Promise<Route>
  push(
    location: RawLocation,
    onComplete?: Function,
    onAbort?: ErrorHandler
  ): void
  replace(
    location: RawLocation,
    onComplete?: Function,
    onAbort?: ErrorHandler
  ): void
  go(n: number): void
  back(): void
  forward(): void
  getMatchedComponents(to?: RawLocation | Route): Component[]
  onReady(cb: Function, errorCb?: ErrorHandler): void
  onError(cb: ErrorHandler): void
  addRoutes(routes: RouteConfig[]): void
  resolve(
    to: RawLocation,
    current?: Route,
    append?: boolean
  ): {
    location: Location
    route: Route
    href: string
    // backwards compat
    normalizedTo: Location
    resolved: Route
  }

  static install: PluginFunction<never>
}

type Position = { x: number; y: number }
type PositionResult = Position | { selector: string; offset?: Position } | void

export interface RouterOptions {
  routes?: RouteConfig[]
  mode?: RouterMode
  fallback?: boolean
  base?: string
  linkActiveClass?: string
  linkExactActiveClass?: string
  parseQuery?: (query: string) => Object
  stringifyQuery?: (query: Object) => string
  scrollBehavior?: (
    to: Route,
    from: Route,
    savedPosition: Position | void
  ) => PositionResult | Promise<PositionResult> | undefined | null
}

type RoutePropsFunction = (route: Route) => Object

export interface PathToRegexpOptions {
  sensitive?: boolean
  strict?: boolean
  end?: boolean
}

export interface RouteConfig {
  path: string
  name?: string   // 命名路由
  component?: Component   // 路由组件
  components?: Dictionary<Component>      // 命名视图组件
  redirect?: RedirectOption
  alias?: string | string[]
  children?: RouteConfig[]
  meta?: any
  beforeEnter?: NavigationGuard
  props?: boolean | Object | RoutePropsFunction

  // 2.6.0+
  caseSensitive?: boolean   // 匹配规则是否大小写敏感(默认值 false)
  pathToRegexpOptions?: PathToRegexpOptions   // 编译正则的选项
}

export interface RouteRecord {
  path: string
  regex: RegExp
  components: Dictionary<Component>
  instances: Dictionary<Vue>
  name?: string
  parent?: RouteRecord
  redirect?: RedirectOption
  matchAs?: string
  meta: any
  beforeEnter?: (
    route: Route,
    redirect: (location: RawLocation) => void,
    next: () => void
  ) => any
  props:
    | boolean
    | Object
    | RoutePropsFunction
    | Dictionary<boolean | Object | RoutePropsFunction>
}

// 并不是 window.location 的引用, vue-router 在内部定义了一个Location, 是一个用来描述目标位置的对象
// $router.push/replace, router-link 的 to 接收的就是 Location 对象
// vue-router 内部可以将一个 url stirng 转换成 Location 对象, 所以确切的说 $router.push/replace, router-link 的 to 接收的都是一个 RawLocation 对象
// RawLocation 是 string 和 Location 的联合类型(type RawLocation = string | Location)
export interface Location {
  name?: string
  path?: string
  hash?: string
  query?: Dictionary<string | (string | null)[] | null | undefined>
  params?: Dictionary<string>
  append?: boolean
  replace?: boolean
}

export interface Route {
  path: string
  name?: string | null
  hash: string
  query: Dictionary<string | (string | null)[]>
  params: Dictionary<string>
  fullPath: string
  matched: RouteRecord[]
  redirectedFrom?: string
  meta?: any
}
