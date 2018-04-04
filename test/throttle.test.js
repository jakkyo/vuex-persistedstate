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

describe('throttle', () => {
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

  it('unsync prevents throttled subscribe call', () => {
    const storage = new Storage();
    const store = new Vuex.Store({ state: { original: 'state0' } });
    const plugin = createPersistedState({
      storage,
      throttleTime: 50
    });

    let unsync;
    return Promise.resolve()
    .then(() => plugin(store))
    .then((synced) => unsync = synced)
    .then(() => {
      store._subscribers[0]('mutation', { original: 'state1' });
      store._subscribers[0]('mutation', { original: 'state2' });
      store._subscribers[0]('mutation', { original: 'state3' });
    })
    .then(() => timeout(5))
    .then(() => unsync())
    .then(() => timeout(50))
    .then(() => {
      expect(storage.getItem('vuex')).toBe(null);
    });
  });
});
