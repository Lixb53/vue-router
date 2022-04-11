import Vue from 'vue'
import VueRouter from 'vue-router'
import Hello from './Hello.vue'

Vue.use(VueRouter)

const componentA = { template: '<div>componentA</div>'}
const componentB = { template: '<div><h3>componentB</h3><ul><li><router-link to="/static/compB/compChildA">compChildA</router-link></li><li><router-link to="/static/compB/compChildB">compChildB</router-link></li><li><router-link to="/static/compB/compChildC">compChildC</router-link></li></ul><router-view></router-view></div>'}
const componentC = { template: '<div>componentC</div>'}
const compChildA = { template: '<div>compChildA</div>'}
const compChildB = { template: '<div>compChildB</div>'}
const compChildC = { template: '<div>compChildC</div>'}

function dynamicPropsFn (route) {
  const now = new Date()
  return {
    name: (now.getFullYear() + parseInt(route.params.years)) + '!'
  }
}

const router = new VueRouter({
  mode: 'history',
  base: __dirname,
  routes: [
    { path: '/', component: Hello }, // No props, no nothing
    { path: '/hello/:name', component: Hello, props: true }, // Pass route.params to props
    { path: '/static', component: Hello, props: { name: 'world' }, children: [      
      { path: 'compA', component: componentA},
      { path: 'compB', component: componentB, children: [
        { path: 'compChildA', component: compChildA },
        { path: 'compChildB', component: compChildB },
        { path: 'compChildC', component: compChildC }
      ]},
      { path: 'compC', component: componentC},
    ] }, // static values
    { path: '/dynamic/:years', component: Hello, props: dynamicPropsFn }, // custom logic for mapping between route and props
    { path: '/attrs', component: Hello, props: { name: 'attrs' }}
  ]
})

new Vue({
  router,
  template: `
    <div id="app">
      <h1>Route props</h1>
      <ul>
        <li><router-link to="/">/</router-link></li>
        <li><router-link to="/hello/you">/hello/you</router-link></li>
        <li><router-link to="/static">/static</router-link></li>
        <li><router-link to="/dynamic/1">/dynamic/1</router-link></li>
        <li><router-link to="/attrs">/attrs</router-link></li>
      </ul>
      <router-view class="view" foo="123"></router-view>
    </div>
  `
}).$mount('#app')
