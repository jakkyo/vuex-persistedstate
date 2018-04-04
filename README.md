# vuex-persisted-preprocess-state

## Requirements

- [Vue.js](https://vuejs.org) (v2.0.0+)
- [Vuex](http://vuex.vuejs.org) (v2.0.0+)

## Installing
```
npm i -S vuex-persisted-preprocess-state
```

## Usage

```js
import createPersistedState from 'vuex-persisted-preprocess-state'

const store = new Vuex.Store({
  // ...
  plugins: [createPersistedState()]
})
```

## API

### `createPersistedState([options])`

Creates a new instance of the plugin with the given options. The following options can be provided to configure the plugin for your specific needs:

- `key <String>`: The key to store the persisted state under. (default: __vuex__)
- `paths <Array>`: An array of any paths to partially persist the state. If no paths are given, the complete state is persisted. (default: __[]__)
- `storage <Object>`: Defaults to sessionStorage.
- `initialSet <Boolean>`: Initial storage set. (default: true)
- `throttleTime <Number>`: Minimum time in ms between storage updates. (default: 0)
- `throttleOptions <Object>`: The throttle options object. (default: {}, defaultOptions: { leading: true, trailing: true })
- `afterLoad <value | Promise(value) <- Function>`: A function that will be called to process storage value before parsing it from json and rehydrating state. Defaults to returning same value.
- `beforeSave <value | Promise(value) <- Function>`: A function that will be called to process vuex state before stringifing it to json and saving to storage. Defaults to returning same value.

## Customize Storage

If it's not ideal to have the state of the Vuex store inside sessionstorage. One can easily implement the functionality to use [cookies](https://github.com/js-cookie/js-cookie) for that (or any other you can think of);

```js
import { Store } from 'vuex'
import createPersistedState from 'vuex-persistedstate'
import * as Cookies from 'js-cookie'

const store = new Store({
  // ...
  plugins: [
    createPersistedState({
      storage: {
        getItem: key => Cookies.get(key),
        setItem: (key, value) => Cookies.set(key, value, { expires: 3, secure: true }),
        removeItem: key => Cookies.remove(key)
      }
    })
  ]
})
```

In fact, any object following the Storage protocol (getItem, setItem, removeItem, etc) could be passed:

```js
createPersistedState({ storage: window.sessionStorage })
```

This is especially useful when you are using this plugin in combination with server-side rendering, where one could pass an instance of [dom-storage](https://www.npmjs.com/package/dom-storage).

## License

MIT © Jake Oswaldo
