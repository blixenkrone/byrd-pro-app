import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';
import { switchMap, finalize, throttleTime, bufferTime, catchError, map, filter, tap, first } from 'rxjs/operators';
import { LoaderService } from '../load.service';

// For pro API
// TODO: get a token and store it localhost from login component
// TODO: get a token from stored credentials
// TODO: if no credentials => /login route
// For byrd API

@Injectable()
export class ProTokenInterceptor implements HttpInterceptor {
	constructor(private auth: AuthService) { }

	intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		const route = req.url.split('/');
		const path = route[3];
		if (path === 'login') {
			// ! TODO: If theres no headers > dont create header req. to pro api
			return req.headers.has('user_token') ? next.handle(req) : of()
		} else {
			return this.auth.getFBAuthToken$()
				.pipe(
					switchMap((token) => {
						// console.log(token ? 'found token' : 'no token')
						return token
							? next.handle(req.clone({
								headers: req.headers.set('user_token', token),
							}))
							: next.handle(req)
					}),
					// ? maybe put a toast msg here for token error
				)
		}
	}
}

// For loading
@Injectable()
export class LoadInterceptor implements HttpInterceptor {
	constructor(private _loadService: LoaderService) { }

	intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		// console.log(req.method)
		// console.log(req.url)
		this._loadService.setGlobalLoading(true)
		return next.handle(req).pipe(
			finalize(() => {
				this._loadService.setGlobalLoading(false)
			}),
		)
	}

}
