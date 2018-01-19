import Vue from 'vue';
import Vuex from 'vuex';
import Storage from 'dom-storage';
import createPersistedState from './index';

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

  const plugin = createPersistedState({ storage });
  return plugin(store)
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

it('should persist the changed parial state back to serialized JSON', () => {
  const storage = new Storage();
  const store = new Vuex.Store({ state: {} });

  const plugin = createPersistedState({ storage, paths: ['changed'] });
  return plugin(store).then(() => {
    return store._subscribers[0]('mutation', { changed: 'state' })
  })
  .then(() => {
    expect(storage.getItem('vuex'))
    .toBe(JSON.stringify({ changed: 'state' }));
  });
});

it('persist the changed partial state back to serialized JSON under a configured key', () => {
  const storage = new Storage();
  const store = new Vuex.Store({ state: {} });

  const plugin = createPersistedState({
    storage,
    key: 'custom',
    paths: ['changed']
  });
  return plugin(store).then(() => {
    return store._subscribers[0]('mutation', { changed: 'state' });
  })
  .then(() => {
    expect(storage.getItem('custom'))
    .toBe(JSON.stringify({ changed: 'state' }));
  });
});

it('persist the changed full state back to serialized JSON when no paths are given', () => {
  const storage = new Storage();
  const store = new Vuex.Store({ state: {} });

  const plugin = createPersistedState({ storage });
  return plugin(store).then(() => {
    return store._subscribers[0]('mutation', { changed: 'state' });
  })
  .then(() => {
    expect(storage.getItem('vuex'))
    .toBe(JSON.stringify({ changed: 'state' }));
  });
});

it('persist the changed partial state back to serialized JSON under a nested path', () => {
  const storage = new Storage();
  const store = new Vuex.Store({ state: {} });

  const plugin = createPersistedState({
    storage,
    paths: ['foo.bar', 'bar']
  });
  return plugin(store).then(() => {
    return store._subscribers[0]('mutation', { foo: { bar: 'baz' }, bar: 'baz' });
  })
  .then(() => {
    expect(storage.getItem('vuex')).toBe(
      JSON.stringify({ foo: { bar: 'baz' }, bar: 'baz' })
    );
  });
});

it('should not persist null values', () => {
  const storage = new Storage();
  const store = new Vuex.Store({
    state: { alpha: { name: null, bravo: { name: null } } }
  });

  const plugin = createPersistedState({
    storage,
    paths: ['alpha.name', 'alpha.bravo.name']
  });
  return plugin(store).then(() => {
    return store._subscribers[0]('mutation', { charlie: { name: 'charlie' } });
  })
  .then(() => {
    expect(storage.getItem('vuex')).toBe(
      JSON.stringify({ alpha: { bravo: {} } })
    );
  });
});

it('should not merge array values when rehydrating', () => {
  const storage = new Storage();
  storage.setItem('vuex', JSON.stringify({ persisted: ['json'] }));

  const store = new Vuex.Store({ state: { persisted: ['state'] } });
  store.replaceState = jest.fn();
  store.subscribe = jest.fn();

  const plugin = createPersistedState({ storage });
  return plugin(store).then(() => {

    expect(store.replaceState).toBeCalledWith({
      persisted: ['json'],
    });

    expect(store.subscribe).toBeCalled();
  });
});

it('should not clone circular objects when rehydrating', () => {
  const circular = { foo: 'bar' };
  circular.foo = circular;

  const storage = new Storage();
  storage.setItem('vuex', JSON.stringify({ persisted: 'baz' }));

  const store = new Vuex.Store({ state: { circular } });
  store.replaceState = jest.fn();
  store.subscribe = jest.fn();

  const plugin = createPersistedState({ storage });
  return plugin(store).then(() => {

    expect(store.replaceState).toBeCalledWith({
      circular,
      persisted: 'baz',
    });

    expect(store.subscribe).toBeCalled();
  });
});

describe('"afterLoad" and "beforeSave" hooks', () => {
  const prefix = "<>";
  function afterLoadSync(str) {
    return str.slice(prefix.length);
  };
  function beforeSaveSync(str) {
    return prefix + str;
  };
  function afterLoadAsync(str) {
    return timeout(10).then(() => afterLoadSync(str));
  };
  function beforeSaveAsync(str) {
    return timeout(10).then(() => beforeSaveSync(str));
  };

  it('should call sync "beforeSave" for initial state', () => {
    const afterLoadMock = jest.fn();
    function afterLoadMocked(str) {
      afterLoadMock(str);
      return afterLoadSync(str);
    };

    const storage = new Storage();
    storage.setItem('vuex', beforeSaveSync(
      JSON.stringify({ persisted: 'json' })
    ));

    const store = new Vuex.Store({
      state: { original: 'state' }
    });
    store.replaceState = jest.fn();

    const plugin = createPersistedState({
      storage,
      afterLoad: afterLoadMocked,
      beforeSave: beforeSaveSync,
    });
    return plugin(store).then(() => {
      expect(store.replaceState).toBeCalledWith({
        original: 'state',
        persisted: 'json'
      });
      expect(afterLoadMock).toBeCalledWith(
        beforeSaveSync(JSON.stringify({ persisted: 'json' }))
      );
    });
  });
  it('should not sync if "beforeSave" throws error', () => {
    const storage = new Storage();
    storage.setItem('vuex', beforeSaveSync(
      JSON.stringify({ persisted: 'json' })
    ));

    const store = new Vuex.Store({
      state: { original: 'state' }
    });
    store.replaceState = jest.fn();
    store.subscribe = jest.fn();

    const plugin = createPersistedState({
      storage,
      afterLoad() {
        throw new Error;
      },
      beforeSave: beforeSaveSync,
    });

    return plugin(store)
    .catch(() => {
      expect(store.replaceState).not.toBeCalled();
      expect(store.subscribe).not.toBeCalled();
    });
  });

  it('should call async "beforeSave" for initial state', () => {
    const afterLoadMock = jest.fn();
    function afterLoadMocked(str) {
      afterLoadMock(str);
      return afterLoadAsync(str);
    };

    const storage = new Storage();
    storage.setItem('vuex', beforeSaveSync(
      JSON.stringify({ persisted: 'json' })
    ));

    const store = new Vuex.Store({
      state: { original: 'state' }
    });
    store.replaceState = jest.fn();

    const plugin = createPersistedState({
      storage,
      afterLoad: afterLoadMocked,
      beforeSave: beforeSaveAsync,
    });
    return plugin(store).then(() => {
      expect(store.replaceState).toBeCalledWith({
        original: 'state',
        persisted: 'json'
      });
      expect(afterLoadMock).toBeCalledWith(
        beforeSaveSync(JSON.stringify({ persisted: 'json' }))
      );
    });
  });

  it('should handle sync hooks', () => {
    const storage = new Storage();
    const store = new Vuex.Store({
      state: { original: 'state' }
    });

    const plugin = createPersistedState({
      storage,
      afterLoad: afterLoadSync,
      beforeSave: beforeSaveSync,
    });
    return plugin(store)
    .then(() => {
      return store._subscribers[0]('mutation', { original: 'newState' });
    })
    .then(() => {
      expect(storage.getItem('vuex')).toBe(beforeSaveSync(
        JSON.stringify({ original: 'newState' })
      ));
    });
  });

  it('should handle async hooks', () => {
    const storage = new Storage();
    const store = new Vuex.Store({
      state: { original: 'state' }
    });

    const plugin = createPersistedState({
      storage,
      afterLoad: afterLoadAsync,
      beforeSave: beforeSaveAsync,
    });
    return plugin(store).then(() => {
      return store._subscribers[0]('mutation', { original: 'newState' });
    })
    .then(() => {
      expect(storage.getItem('vuex')).toBe(beforeSaveSync(
        JSON.stringify({ original: 'newState' })
      ));
    });
  });

  it('should prevent "beforeSave" races', () => {
    const storage = new Storage();
    const store = new Vuex.Store({
      state: { original: 'state' }
    });

    let delayDelta = 25;
    let delay = 5;
    function beforeSaveWithRaces(state) {
      const result = timeout(delay).then(() => state);
      delay += delayDelta;

      return result;
    }

    const plugin = createPersistedState({
      storage,
      beforeSave: beforeSaveWithRaces,
    });
    return plugin(store).then(() => {
      store._subscribers[0]('mutation', { original: 'stateWithRace' });
      store._subscribers[0]('mutation', { original: 'stateFinal' });
    })
    .then(() => {
      expect(storage.getItem('vuex')).toBe(null);
    })
    .then(() => timeout(10))
    .then(() => {
      expect(storage.getItem('vuex')).toBe(null);
    })
    .then(() => timeout(10 + delayDelta))
    .then(() => {
      expect(storage.getItem('vuex')).toBe(
        JSON.stringify({ original: 'stateFinal' })
      );
    })
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
    return synced.then((unsync) => unsync());
  })
  .then(() => {
    return expect(store._subscribers.length).toBe(0);
  });
});

it('throttles subscribe call', () => {
  const storage = new Storage();
  const store = new Vuex.Store({ state: { original: 'state0' } });
  const plugin = createPersistedState({
    storage,
    throttleTime: 50
  });

  return plugin(store)
  .then(() => {
    store._subscribers[0]('mutation', { original: 'state1' });
    store._subscribers[0]('mutation', { original: 'state2' });
    store._subscribers[0]('mutation', { original: 'state3' });
  })
  .then(() => timeout(5))
  .then(() => {
    expect(storage.getItem('vuex')).toBe(
      JSON.stringify({ original: 'state1' })
    );
  })
  .then(() => timeout(50))
  .then(() => {
    expect(storage.getItem('vuex')).toBe(
      JSON.stringify({ original: 'state3' })
    );
  });
});
