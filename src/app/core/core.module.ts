import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavComponent } from '../components/nav/nav.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AngularFireModule } from '@angular/fire';
import { AngularFireAuthModule } from '@angular/fire/auth';
import { AngularFireStorageModule } from '@angular/fire/storage';
import { environment } from 'src/environments/environment.dev';
import { HttpClientModule } from '@angular/common/http';
import { httpTokenInterceptor } from '../core/http-interceptors';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterModule } from '@angular/router';

@NgModule({
	imports: [
		CommonModule,
		HttpClientModule,
		BrowserAnimationsModule,
		RouterModule,
		AngularFireModule.initializeApp(environment.fbConfig),
		AngularFireAuthModule,
		AngularFireStorageModule,
		MatProgressSpinnerModule,
		MatSnackBarModule,
		MatMenuModule,
	],
	declarations: [
		NavComponent,
	],
	exports: [
		NavComponent
	],
	providers: [
		httpTokenInterceptor, // This is two interceptors (pro and byrd api)
	]
})
export class CoreModule { }
