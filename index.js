import merge from 'deepmerge';
import shvl from 'shvl';
import canWriteStorageCheck from 'can-use-storage-check';
import throttle from 'lodash.throttle';
import uuid from 'random-uuid-v4';

export default function(options = {}) {
  const storage = options.storage || (window && window.sessionStorage);
  const key = options.key || 'vuex';
  const throttleTime = options.throttleTime || 0;
  const afterLoad = options.afterLoad || (val => val);
  const beforeSave = options.beforeSave || (val => val);

  function getState(key, storage) {
    let value;
    return Promise.resolve()
      .then(() => storage.getItem(key))
      .then(value => {
        if (value === 'undefined') {
          return undefined;
        }
        return Promise.resolve()
          .then(() => afterLoad(value))
          .then(state => JSON.parse(state))
          .catch(() => undefined);
      });
  }

  let lastSaveIndex = null;
  function setState(key, state, storage) {
    const saveIndex = uuid();
    lastSaveIndex = saveIndex;

    return Promise.resolve()
      .then(() => beforeSave(JSON.stringify(state)))
      .then(state => {
        if (lastSaveIndex !== saveIndex) {
          return Promise.resolve();
        }
        return storage.setItem(key, state);
      });
  }

  function reducer(state, paths) {
    return paths.length === 0
      ? state
      : paths.reduce(function(substate, path) {
          return shvl.set(substate, path, shvl.get(state, path));
        }, {});
  }

  function subscriber(store, handler) {
    return store.subscribe(handler);
  }

  return function(store) {
    return Promise.resolve()
      .then(() => canWriteStorageCheck(storage))
      .then(canWriteStorage => {
        if (!canWriteStorage) {
          throw new Error('Invalid storage instance given');
        }
      })
      .then(() => getState(key, storage))
      .then(savedState => {
        if (typeof savedState === 'object' && savedState !== null) {
          store.replaceState(
            merge(store.state, savedState, {
              arrayMerge: function(store, saved) {
                return saved;
              },
              clone: false
            })
          );
        }
      })
      .then(() => {
        return subscriber(
          store,
          throttle((mutation, state) => {
            const reducedState = reducer(state, options.paths || []);
            return setState(key, reducedState, storage);
          }, throttleTime)
        );
      });
  };
}
