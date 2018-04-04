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
