const myView = {
    functional: true,
    render(h, { parent, data }) {
        console.log(parent, data)
        const { matched } = parent.$route

        data.routerView = true
        let depth = 0

        while (parent) {
            if (parent.$vnode && parent.$vnode.data.routerView) {
                depth++
            }
            parent = parent.$parent
        }

        const record = matched[depth]
        console.log(record)

        if (!record) return h()

        const component = record.component

        return h(component, data)
    }
}

export default myView