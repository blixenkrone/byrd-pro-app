import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { UserService } from 'src/app/services/user.service';
import { catchError, switchMap, mergeMap, finalize, first, tap } from 'rxjs/operators';
import { of, Subscription, throwError } from 'rxjs';
import { FormGroup, Validators, FormBuilder, AbstractControl } from '@angular/forms';
import { Router } from '@angular/router';
import { LoaderService } from 'src/app/core/load.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
	selector: 'app-login',
	templateUrl: './login.component.html',
	styleUrls: ['./login.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit, OnDestroy {

	private loginSubscription!: Subscription;
	loggedIn = false;
	error!: Error;
	loginForm!: FormGroup;
	isLoading$ = this.loadSrv.isHTTP$

	constructor(
		private fb: FormBuilder,
		private authSrv: AuthService,
		private router: Router,
		private snackBar: MatSnackBar,
		private loadSrv: LoaderService,
		private usrSrv: UserService) { }

	ngOnInit() {
		this.loginForm = this.fb.group({
			email: ['', [Validators.required, Validators.email]],
			password: ['', [Validators.required, Validators.minLength(6)]]
		})
	}

	ngOnDestroy() {
		if (this.loginSubscription) {
			this.loginSubscription.unsubscribe();
		}
	}

	login(email: string, password: string) {
		this.loadSrv.setGlobalLoading(true)
		const loginProUser$ = this.authSrv.fbLoginWithEmailAndPassword$(email, password).pipe(
			catchError(res => {
				console.log(res)
				const errMsg = res.code === 'auth/wrong-password"' ? res.code : res;
				this.snackBar.open(`${errMsg}`, undefined, { duration: 3000 })
				return throwError(res.error)
			}),
			switchMap(((fbUserCreds) => {
				this.authSrv.getUserAccess$(email, password).pipe(
					tap(acc => acc.isPro ? true : throwError('User is not professional')),
				)
				return fbUserCreds.user ? this.usrSrv.getUserByUID$(fbUserCreds.user.uid) : throwError('No uid was found for user')
			}
			)),
			first(),
			finalize(() => this.loadSrv.setGlobalLoading(false))
		)

		// Make it hot yo
		this.loginSubscription = loginProUser$.subscribe(res => {
			console.log(res)
			if ((res as any).error) {
				this.snackBar.open((res as any).error.msg, undefined, { duration: 3000 })
				return
			}
			this.snackBar.open(`Welcome ${res.displayName}!`, undefined, { duration: 3000 })
			this.loggedIn = true;
			this.usrSrv.setUser(res)
			this.router.navigate(['/upload'])
				.then(() => window.location.reload())
		})
	}

	signupAsPro() {
		window.location.assign('https://www.byrd.news/pro-register')
	}

	fValue(control: string) { return this.loginForm.get(control) as AbstractControl }

}
