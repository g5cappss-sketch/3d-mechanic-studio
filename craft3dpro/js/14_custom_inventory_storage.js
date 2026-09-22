// ==========================================
// FILE: 14_custom_inventory_storage.js
// CHỨC NĂNG: Lưu file model và metadata socket trong kho tùy chỉnh bằng IndexedDB.
// ==========================================

const CUSTOM_INVENTORY_DB_NAME = 'craft3d-custom-inventory';
const CUSTOM_INVENTORY_STORE = 'models';

function openCustomInventoryStorage() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('Trình duyệt không hỗ trợ IndexedDB.'));
      return;
    }

    const request = indexedDB.open(CUSTOM_INVENTORY_DB_NAME, 1);
    request.onupgradeneeded = event => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(CUSTOM_INVENTORY_STORE)) {
        database.createObjectStore(CUSTOM_INVENTORY_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function saveCustomInventoryModel(record) {
  return openCustomInventoryStorage().then(database => new Promise((resolve, reject) => {
    const transaction = database.transaction(CUSTOM_INVENTORY_STORE, 'readwrite');
    transaction.objectStore(CUSTOM_INVENTORY_STORE).put(record);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  }));
}

function deleteCustomInventoryModel(id) {
  return openCustomInventoryStorage().then(database => new Promise((resolve, reject) => {
    const transaction = database.transaction(CUSTOM_INVENTORY_STORE, 'readwrite');
    transaction.objectStore(CUSTOM_INVENTORY_STORE).delete(id);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  }));
}

function loadCustomInventoryModels() {
  return openCustomInventoryStorage().then(database => new Promise((resolve, reject) => {
    const request = database.transaction(CUSTOM_INVENTORY_STORE, 'readonly')
      .objectStore(CUSTOM_INVENTORY_STORE)
      .getAll();
    request.onsuccess = () => {
      database.close();
      resolve(request.result || []);
    };
    request.onerror = () => {
      database.close();
      reject(request.error);
    };
  }));
}
