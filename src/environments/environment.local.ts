export const environment = {
	production: false,
	serviceWorker: false,
	apiVersion: 'v1',
	proApiUrl: `http://localhost:3000`,
	byrdApiUrl: `http://localhost:2222/v1`,
	fbConfig: {
		apiKey: 'AIzaSyDZw30D6GVrqkaGtLJ0RSYFBU0vgvrB5Vo',
		authDomain: 'byrd-development.firebaseapp.com',
		databaseURL: 'https://byrd-development.firebaseio.com',
		projectId: 'byrd-development',
		storageBucket: 'byrd-development',
		messagingSenderId: '743878726887'
	}
};

/*
 * For easier debugging in development mode, you can import the following file
 */
import 'zone.js/dist/zone-error';  // Included with Angular CLI.
