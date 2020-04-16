import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ViewChild, ElementRef, ViewChildren, QueryList } from '@angular/core';
import { FormGroup, FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { NgxFileDropEntry, FileSystemFileEntry } from 'ngx-file-drop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, combineLatest, of, Subject, forkJoin, zip, throwError, BehaviorSubject } from 'rxjs';
import { BookingService, MediaBooking, MediaBookingResponse, MediaFile } from './booking.service';
import { tap, map, startWith, switchMap, catchError, takeUntil, filter, finalize, first, share, shareReplay } from 'rxjs/operators';
import { UserService } from 'src/app/services/user.service';
import { MatTableDataSource, MatTable } from '@angular/material/table';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ComponentType } from '@angular/cdk/portal';
import { HttpEventType, HttpResponse } from '@angular/common/http';
import { IMediaUser, IProUser } from 'src/app/core/models/user.model';
import { LoaderService } from 'src/app/core/load.service';
import { UploadDialogComponent } from 'src/app/shared/upload-dialog/upload-dialog.component';
import { DialogService } from 'src/app/shared/upload-dialog/upload-dialog.service';
// import { UploadDialogComponent } from 'src/app/shared/upload-dialog/upload-dialog.component';

interface IBookingState {
	user: IProUser;
	files: MediaFile[];
	// isLoading: boolean;
	medias: IMediaUser[];
}

const dialogCfg: MatDialogConfig = {
	autoFocus: false,
	disableClose: true,
	panelClass: 'dialog-class', // ? does not work
	width: '30rem',
	height: '26rem',
}

@Component({
	selector: 'app-booking',
	templateUrl: './booking.component.html',
	styleUrls: ['./booking.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingComponent implements OnInit, OnDestroy {
	private readonly fileLimit = 100;
	readonly displayedColumns: string[] = ['name', 'date', 'size', 'ext', 'delete'];
	private destroyed$ = new Subject();
	dataSource = new MatTableDataSource()
	@ViewChild('matTableRef') readonly matTableRef!: MatTable<any>;
	@ViewChildren('dropZone') dropZone!: QueryList<any>;
	bookingForm!: FormGroup;

	constructor(
		private dialogSrv: DialogService,
		private router: Router,
		// private matDialog: MatDialog,
		private usrSrv: UserService,
		private bookingSrv: BookingService,
		private snackSrv: MatSnackBar,
		private fb: FormBuilder,
		private loadSrv: LoaderService) { }


	mediasAvailable$: Observable<IMediaUser[]> = this.bookingSrv.getMediasAvailable$()
	files$: Observable<MediaFile[]> = this.bookingSrv.files$.pipe(
		takeUntil(this.destroyed$),
	)

	// user$ = this.usrSrv.user$
	user$ = this.usrSrv.user$
	isLoading$ = this.loadSrv.isWait$
	progress$ = this.loadSrv.progress$

	// * this is async called in HTML
	data$: Observable<IBookingState> = of();
	// data!: IBookingState;

	ngOnInit() {
		this.bookingForm = this.fb.group({
			headline: ['', Validators.compose([Validators.maxLength(400), Validators.minLength(15), Validators.required])],
			displayName: [{ value: '', disabled: true }, Validators.required],
			mediaUID: ['', Validators.required],
		})

		this.dataSource.connect()
		// * Needs to be cleared to have the initial value: [];
		this.removeAllFiles()
		// * Called in HTML - main data observable */
		this.data$ = this.getData()
	}

	ngOnDestroy() {
		this.destroyed$.next()
		this.destroyed$.unsubscribe()
	}

	zoneClicked(c: ElementRef | any) {
		(c.fileSelector.nativeElement as HTMLInputElement).click();
	}

	getData = (): Observable<IBookingState> => {
		return combineLatest(this.user$, this.files$, this.mediasAvailable$).pipe(
			map(([user, files, medias]) => ({ user, files, medias })),
			tap(v => {
				this.bookingForm.get('displayName')!.setValue(v.user.displayName)
				this.dataSource.data = [...v.files]
			}),
			catchError(err => {
				this.snackSrv.open(err.message || err.error, undefined, { duration: 3000 })
				if (err.status === 401 || err.statusCode === 404) {
					this.router.navigate(['/login'])
				}
				console.log(err)
				return throwError(err)
			}),
			filter(v => !!v),
			// tap(v => console.log(v)),
			finalize(() => {
				this.loadSrv.setGlobalLoading(false)
			})
		)
	}

	// * Also used in HTML
	removeAllFiles() {
		this.bookingSrv.clearFiles()
	}

	/**
	 * * Upload request is split into two req's:
	 * first req attempts to call and create the text info => returns a media_data_hash
	 * second req calls endpoint with the {{media_data_hash}} and files included.
	 * TODO: handle [] file size and file length
	 */
	uploadFiles(files: MediaFile[], photographerUID: string) {
		if ((files as MediaFile[]).length > 0) {
			if (this.bookingForm.valid) { /** also handled in html */
				this.snackSrv.open('Uploading content...', undefined, { duration: 2000 }) // something not 0
				const dialogRef = this.dialogSrv.openDialog(UploadDialogComponent, { isLoading: true, progress: 0 })

				const { headline, mediaUID } = this.bookingForm.value as MediaBooking;
				const booking: MediaBooking = { headline, mediaUID, photographerUID }
				// console.log(booking)
				// console.log(files)
				this.bookingSrv.initBooking(booking).pipe(
					switchMap((init: MediaBookingResponse) => this.bookingSrv.uploadFiles(files, init.data!.mediaUploadHash)),
					catchError((res: any) => {
						dialogRef.close()
						return throwError(res.error.msg);
					}),
					takeUntil(this.destroyed$),
					finalize(() => {
						this.loadSrv.setGlobalLoading(false)
					})
				).subscribe((event) => {
					if (event.type === HttpEventType.UploadProgress) {
						// This is an upload progress event. Compute and show the % done:
						const percentDone = Math.round(100 * event.loaded / (event as any).total);
						console.log(`File is ${percentDone}% uploaded.`);
						this.dialogSrv.setDialogData({ isLoading: true, progress: percentDone })
					}
					else if (event instanceof HttpResponse) {
						console.log(event)
						console.log('File is completely uploaded!');
						if (event.status === 200) {
							this.dialogSrv.setDialogData({
								isLoading: false,
								status: event.status,
								progress: 100,
								error: (event as any).error
							})
							this.removeAllFiles()
						} else {
							this.snackSrv.open((event as any).error, undefined, { duration: 4000 })
						}
					}
				})
			}
		} else {
			this.snackSrv.open('You should add more files.')
		}
	}

	async onFileDropped(files: NgxFileDropEntry | NgxFileDropEntry[], existingFiles: MediaFile[]) {
		const error = this.verifyFiles(files, existingFiles)
		if (error instanceof Error) {
			this.snackSrv.open(error.message, undefined, { duration: 3000 })
			return;
		}
		if (files instanceof Array) {
			for (const droppedFile of files) {
				const fileEntry = droppedFile.fileEntry as FileSystemFileEntry;
				try {
					const unwrappedFile = await this.unwrapFileEntry(fileEntry)
					const readFile = this.readFileProps(unwrappedFile)
					existingFiles.push(readFile)
				} catch (e) {
					console.error(e)
					this.snackSrv.open(e, undefined, { duration: 3000 })
					return;
				}
			}
		} else {
			const file = files.fileEntry as FileSystemFileEntry;
			try {
				const unwrappedFile = await this.unwrapFileEntry(file)
				const readFile = this.readFileProps(unwrappedFile)
				existingFiles.push(readFile)
			} catch (e) {
				console.error(e)
				this.snackSrv.open(e, undefined, { duration: 3000 })
				return;
			}
		}
		this.bookingSrv.setFiles(existingFiles)
		// console.log(existingFiles)
	}

	private readFileProps = (f: File): MediaFile => {
		const fileExt = f.name.toLowerCase().split('.').pop();
		let fileSize = (f.size >> 20);
		fileSize += Number((fileSize * 0.045).toFixed(2))
		const fName = f.name.length > 15 ? f.name.slice(0, 15) + `...` : f.name;
		return {
			name: fName,
			date: Date.now(),
			ext: fileExt,
			fileSize: fileSize,
			file: f,
		} as MediaFile;
	}

	private verifyFiles(droppedFiles: NgxFileDropEntry | NgxFileDropEntry[], existingFiles: MediaFile[]): Error | void {
		if (droppedFiles instanceof Array) {
			if (existingFiles.length + droppedFiles.length > this.fileLimit) {
				return new Error('Maxiumum number of files allowed are 100.')
			}
		} else {
			return ++existingFiles.length > this.fileLimit ? new Error('Maxiumum number of files allowed are 100.') : void 0;
		}
		return
	}

	removeFileEntry(existingFiles: MediaFile[], target: MediaFile) {
		const idx = existingFiles.indexOf(target)
		if (idx > -1 && existingFiles.includes(target)) {
			const removed = existingFiles.splice(idx, 1)
			console.log(idx)
			this.bookingSrv.setFiles(existingFiles)
			this.snackSrv.open(`Removed file ${removed[0].name}`, undefined, { duration: 1500 })
		}
	}

	// Promise to unwrap it from FileSystemEntry interface
	private unwrapFileEntry = (file: FileSystemFileEntry): Promise<File> => {
		return new Promise((res) => {
			file.file((f => res(f)))
		})
	}

	// * HELPER METHODS */
	fValue(control: string) { return this.bookingForm.get(control) as AbstractControl }

	getTotalFilesize = (files: MediaFile[]) => files.map(f => f.fileSize).reduce((acc, value) => acc + value, 0).toFixed(2)

	onFileHover(event: NgxFileDropEntry) { }
	onFileLeave(event: NgxFileDropEntry) { }

}
