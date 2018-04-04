import merge from 'deepmerge';
import shvl from 'shvl';
import canWriteStorageCheck from 'can-use-storage-check';
import throttle from 'lodash.throttle';
import uuid from 'random-uuid-v4';

export default function(options = {}) {
  const storage = options.storage || (window && window.sessionStorage);
  const key = options.key || 'vuex';
  const paths = options.paths || [];
  const pathsForSubcscribe = paths.map(path => {
    return path.split('.').join('/');
  });
  const throttleTime = options.throttleTime || 0;
  const throttleOptions = options.throttleOptions || undefined;
  const afterLoad = options.afterLoad || (val => val);
  const beforeSave = options.beforeSave || (val => val);
  const initialSet = options.initialSet || false;

  function getState(key, storage) {
    let value;
    return Promise.resolve()
      .then(() => storage.getItem(key))
      .then(value => {
        if (value === 'undefined' || value == null) {
          return null;
        }
        return Promise.resolve(value)
          .then(afterLoad)
          .then(JSON.parse);
      });
  }

  let lastSaveIndex = null;
  let unsynced = false;
  function setState(key, state, storage) {
    const saveIndex = uuid();
    lastSaveIndex = saveIndex;

    return Promise.resolve()
      .then(() => beforeSave(JSON.stringify(state)))
      .then(state => {
        if (unsynced || lastSaveIndex !== saveIndex) {
          return Promise.resolve();
        }
        return storage.setItem(key, state);
      });
  }

  function removeState(key, storage) {
    return Promise.resolve().then(() => storage.removeItem(key));
  }

  function reducer(state, paths) {
    return paths.length === 0
      ? state
      : paths.reduce(function(substate, path) {
          return shvl.set(substate, path, shvl.get(state, path));
        }, {});
  }

  function satisfyToPath(type) {
    const havePaths = pathsForSubcscribe.length > 0;
    const satisfyToSomePath = pathsForSubcscribe.some(path => {
      return type.indexOf(path) === 0;
    });
    if (havePaths && !satisfyToSomePath) {
      return false;
    }
    return true;
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
        if (typeof savedState === 'object' && savedState != null) {
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
        if (!initialSet) {
          return;
        }
        const reducedState = reducer(store.state, paths);
        return setState(key, reducedState, storage);
      })
      .then(() => {
        const unsyncFunction = subscriber(
          store,
          throttle(
            (mutation, state) => {
              if (!satisfyToPath(mutation.type)) {
                return;
              }
              const reducedState = reducer(state, paths);
              return setState(key, reducedState, storage);
            },
            throttleTime,
            throttleOptions
          )
        );

        return function() {
          unsynced = true;

          unsyncFunction();
          return removeState(key, storage);
        };
      });
  };
}
