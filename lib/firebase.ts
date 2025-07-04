import { initializeApp } from "firebase/app"
import { getDatabase } from "firebase/database"

const firebaseConfig = {
  apiKey: "AIzaSyB1HKFjB7AZFLZ-P-iixMd9SdGA5njXN4c",
  authDomain: "e-perpus-13f02.firebaseapp.com",
  databaseURL: "https://e-perpus-13f02-default-rtdb.firebaseio.com",
  projectId: "e-perpus-13f02",
  storageBucket: "e-perpus-13f02.firebasestorage.app",
  messagingSenderId: "135325587497",
  appId: "1:135325587497:web:314f93fd9c72f16a8a2438",
}

const app = initializeApp(firebaseConfig)
export const database = getDatabase(app)
