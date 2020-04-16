import { Component, OnInit } from '@angular/core';
import { UserService } from './services/user.service';
import { catchError, tap, finalize, first, delay } from 'rxjs/operators';
import { throwError, Observable, of } from 'rxjs';
import { IProUser } from './core/models/user.model';
import { LoaderService } from './core/load.service';
import { Router } from '@angular/router';

@Component({
	selector: 'app-root',
	template: `
	<mat-progress-bar mode="indeterminate" color="accent" *ngIf="(isWait$ | async)"></mat-progress-bar>
	<app-nav [user]="(user$ | async)"></app-nav>
	<router-outlet></router-outlet>
	`,
	styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
	user$!: Observable<IProUser>;
	constructor(
		// private updateSw: UpdateService,
		private _router: Router,
		private _userService: UserService,
		private _loadService: LoaderService) { }

	isWait$ = this._loadService.isWait$

	ngOnInit() {
		this._loadService.setGlobalLoading(true)
		this.user$ = this._userService.getUserByTokenHeader$().pipe(
			catchError(err => {
				if (err.status === 523) { console.log('incorrect token') }
				this._router.navigate(['login'])
				return throwError(err)
			}),
			tap(user => this._userService.setUser(user)),
		)
	}
}
