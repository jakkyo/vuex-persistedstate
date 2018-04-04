import Vue from 'vue';
import Vuex from 'vuex';
import Storage from 'dom-storage';
import createPersistedState from '../index';

// Do not show the production tip while running tests.
Vue.config.productionTip = false;

Vue.use(Vuex);

function timeout(delay) {
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
};

it('can be created with the default options', () => {
  window.sessionStorage = new Storage();
  expect(() => createPersistedState()).not.toThrow();
});

it('cannot be created with invalid storage', () => {
  const storage = {};

  const store = new Vuex.Store({ state: { original: 'state' } });
  store.replaceState = jest.fn();
  store.subscribe = jest.fn();

  return Promise.resolve()
  .then(() => createPersistedState({ storage }))
  .then((plugin) => plugin(store))
  .catch(() => {
    expect(store.replaceState).not.toBeCalled();
    expect(store.subscribe).not.toBeCalled();
  });
});

it('works with async storages', () => {
  const normalStorage = new Storage();
  normalStorage.setItem('vuex', JSON.stringify({ persisted: 'json' }));

  const storage = {
    setItem(key, value) {
      return timeout(10).then(() => normalStorage.setItem(key, value));
    },
    getItem(key) {
      return timeout(10).then(() => normalStorage.getItem(key));
    },
    removeItem(key) {
      return timeout(10).then(() => normalStorage.removeItem(key));
    },
  };

  const store = new Vuex.Store({ state: { original: 'state' } });
  store.replaceState = jest.fn();
  store.subscribe = jest.fn();

  const plugin = createPersistedState({ storage });
  return plugin(store)
  .then(() => {
    expect(store.replaceState).toBeCalledWith({
      original: 'state',
      persisted: 'json'
    });
    expect(store.subscribe).toBeCalled();
  });
});

it("replaces store's state and subscribes to changes when initializing", () => {
  const storage = new Storage();
  storage.setItem('vuex', JSON.stringify({ persisted: 'json' }));

  const store = new Vuex.Store({ state: { original: 'state' } });
  store.replaceState = jest.fn();
  store.subscribe = jest.fn();

  const plugin = createPersistedState({ storage });
  return plugin(store).then(() => {
    expect(store.replaceState).toBeCalledWith({
      original: 'state',
      persisted: 'json'
    });
    expect(store.subscribe).toBeCalled();
  });
});

it("does not replaces store's state when receiving invalid JSON", () => {
  const storage = new Storage();
  storage.setItem('vuex', '<invalid JSON>');

  const store = new Vuex.Store({ state: { nested: { original: 'state' } } });
  store.replaceState = jest.fn();
  store.subscribe = jest.fn();

  const plugin = createPersistedState({ storage });
  return plugin(store)
  .catch(() => {
    expect(store.replaceState).not.toBeCalled();
    expect(store.subscribe).not.toBeCalled();
  });
});

it("does not replaces store's state when receiving null", () => {
  const storage = new Storage();
  storage.setItem('vuex', JSON.stringify(null));

  const store = new Vuex.Store({ state: { nested: { original: 'state' } } });
  store.replaceState = jest.fn();
  store.subscribe = jest.fn();

  const plugin = createPersistedState({ storage });
  return plugin(store)
  .catch(() => {
    expect(store.replaceState).not.toBeCalled();
    expect(store.subscribe).not.toBeCalled();
  });
});

it("respects nested values when it replaces store's state on initializing", () => {
  const storage = new Storage();
  storage.setItem('vuex', JSON.stringify({ persisted: 'json' }));

  const store = new Vuex.Store({ state: { original: 'state' } });
  store.replaceState = jest.fn();
  store.subscribe = jest.fn();

  const plugin = createPersistedState({ storage });
  return plugin(store).then(() => {
    expect(store.replaceState).toBeCalledWith({
      original: 'state',
      persisted: 'json'
    });
    expect(store.subscribe).toBeCalled();
  });
});

it('should persist state under a custom storage key', () => {
  const storage = new Storage();
  const store = new Vuex.Store({ state: {} });
  const changedState = { changed: 'state' };

  const plugin = createPersistedState({
    storage,
    key: 'custom',
  });
  return plugin(store).then(() => {
    return store._subscribers[0]('mutation', changedState);
  })
  .then(() => {
    expect(storage.getItem('custom'))
    .toBe(JSON.stringify(changedState));
  });
});

it('can be unsubscribed', () => {
  const storage = new Storage();
  const store = new Vuex.Store({ state: { original: 'state' } });
  const plugin = createPersistedState({ storage });
  const synced = plugin(store);

  return synced.then(() => {
    return store._subscribers[0]('mutation', { original: 'newState' });
  })
  .then(() => {
    expect(storage.getItem('vuex')).toBe(
      JSON.stringify({ original: 'newState' })
    );
    return synced.then((unsync) => {
      const unsyncCall = unsync();

      expect(unsyncCall instanceof Promise).toBe(true);
      return unsyncCall;
    });
  })
  .then(() => {
    expect(store._subscribers.length).toBe(0);
    expect(storage.getItem('vuex')).toBe(null);
  });
});
