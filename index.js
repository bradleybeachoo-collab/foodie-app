import { registerRootComponent } from 'expo';
import App from './App';

// Start the same App component on Android, iOS, and the web.
registerRootComponent(App);

// Snack also reads the entry file's default export.
export default App;
