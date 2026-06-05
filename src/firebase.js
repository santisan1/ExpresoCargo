const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const SDK_VERSION = '10.14.1'
const appModuleUrl = `https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`
const authModuleUrl = `https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`
const firestoreModuleUrl = `https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`

let firebasePromise

// Carga únicamente Firebase Client SDK modular: initializeApp, getAuth y getFirestore.
export function getFirebase() {
  if (!firebasePromise) {
    firebasePromise = Promise.all([
      import(/* @vite-ignore */ appModuleUrl),
      import(/* @vite-ignore */ authModuleUrl),
      import(/* @vite-ignore */ firestoreModuleUrl),
    ]).then(([appSdk, authSdk, firestore]) => {
      const app = appSdk.initializeApp(firebaseConfig)
      return {
        app,
        auth: authSdk.getAuth(app),
        db: firestore.getFirestore(app),
        authSdk,
        firestore,
      }
    })
  }
  return firebasePromise
}

export { firebaseConfig }
