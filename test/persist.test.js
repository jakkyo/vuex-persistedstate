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

describe('persist', () => {
  it('full state', () => {
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

  it('partial state', () => {
    const storage = new Storage();
    const store = new Vuex.Store({ state: {} });
    const paths = ['path'];
    const mutation = { type: 'path/mutation' };
    const changedState = { path: 'state' };

    const plugin = createPersistedState({ storage, paths });
    return plugin(store).then(() => {
      return store._subscribers[0](mutation, changedState)
    })
    .then(() => {
      expect(storage.getItem('vuex'))
      .toBe(JSON.stringify(changedState));
    });
  });

  it('partial state under a nested path', () => {
    const storage = new Storage();
    const store = new Vuex.Store({ state: {} });

    const plugin = createPersistedState({
      storage,
      paths: ['foo.bar', 'bar']
    });
    const mutation = { type: 'foo/bar/mutation' };

    return plugin(store).then(() => {
      return store._subscribers[0](
        mutation,
        { foo: { bar: 'baz' }, bar: 'baz' }
      );
    })
    .then(() => {
      expect(storage.getItem('vuex')).toBe(
        JSON.stringify({ foo: { bar: 'baz' }, bar: 'baz' })
      );
    });
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
  const mutation = { type: 'alpha/name/mutation' };

  return plugin(store).then(() => {
    return store._subscribers[0](
      mutation,
      { charlie: { name: 'charlie' } }
    );
  })
  .then(() => {
    expect(storage.getItem('vuex')).toBe(
      JSON.stringify({ alpha: { bravo: {} } })
    );
  });
});

it('should not update partial state on mutations with bad paths', () => {
  const storage = new Storage();
  const store = new Vuex.Store({ state: {} });
  const paths = ['path'];
  const mutation = { type: 'badPath/mutation' };
  const changedState = { path: 'state' };

  const plugin = createPersistedState({ storage, paths });
  return plugin(store).then(() => {
    return store._subscribers[0](mutation, changedState)
  })
  .then(() => {
    expect(storage.getItem('vuex')).toBe(null);
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
