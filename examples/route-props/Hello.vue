<template>
  <div>
    <h2 class="hello">Hello {{name}} {{ $attrs }}</h2>
    <ul>
      <li><router-link to="/static/compA">componentA</router-link></li>
      <li><router-link to="/static/compB">componentB</router-link></li>
      <li><router-link to="/static/compC">componentC</router-link></li>
    </ul>
    <router-view></router-view>
  </div>
</template>

<script>



export default {
  props: {
    name: {
      type: String,
      default: 'Vue!'
    }
  }
}
</script>
