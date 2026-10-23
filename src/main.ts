import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { useAppStore } from './stores/app';
import './style.css';

const app = createApp(App);
app.use(createPinia());

const store = useAppStore();
store.init().finally(() => {
  app.use(router);
  app.mount('#app');
});
