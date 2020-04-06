import { StepperService } from 'src/app/shared/shared.service';
import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { IStep } from 'src/app/shared/stepper/stepper.component';
import { UploadService, LocationService, IGeocodingPlace, IGeoLocation } from 'src/app/components/upload/upload.service';
import { Observable, of, Subject, throwError, BehaviorSubject, combineLatest, concat, forkJoin, merge, zip, from, iif } from 'rxjs';
import { IStoryFile, MetadataResponse, Story, IStoryValueOptions, IStoryUploadResponse } from './upload.types';
import { tap, takeUntil, catchError, debounceTime, share, map, startWith, distinctUntilChanged, filter, take, mergeMap, retry, switchMap, finalize, concatMap, exhaustMap, withLatestFrom, reduce, mergeAll, scan, delay, concatAll, mapTo, mergeScan, distinctUntilKeyChanged } from 'rxjs/operators';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoaderService } from 'src/app/core/load.service';
import { IProUser } from 'src/app/core/models/user.model';
import { UserService } from 'src/app/services/user.service';
import { DialogService } from 'src/app/shared/upload-dialog/upload-dialog.service';
import { UploadDialogComponent } from 'src/app/shared/upload-dialog/upload-dialog.component';
import { HttpResponse } from '@angular/common/http';

@Component({
	selector: 'app-upload',
	templateUrl: './upload.component.html',
	styleUrls: ['./upload.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UploadComponent implements OnInit, OnDestroy {

	readonly steps: IStep[] = [
		{ name: 'Choose your material', num: 1 },
		{ name: 'Upload your story', num: 2 },
		{ name: 'Story is uploaded', num: 3 }]

	readonly headliners = [
		{ headline: 'Drop or select your photos or video', sub: 'Select up to five photos or one video' },
		{ headline: 'Add relevant information and click upload', sub: `What's the story about?`, },
		{ headline: 'Your upload is finalized', sub: `You're good to go`, },
	]

	activeDumpSubj$ = new BehaviorSubject<boolean>(false);
	private destroyed$ = new Subject();

	// mediaType!: EMediaType;
	step!: number;
	storyForm!: FormGroup;
	storyInfoFormVal!: IStoryValueOptions;
	locationForm!: FormGroup;
	locationResults$!: Observable<IGeocodingPlace[]>;

	data$!: Observable<IStoryFile[]>;

	constructor(
		private dialogService: DialogService,
		private userService: UserService,
		private router: Router,
		private fb: FormBuilder,
		private loadService: LoaderService,
		private uploadService: UploadService,
		private locationService: LocationService,
		private stepService: StepperService) { }

	user$ = this.userService.user$
	isWait$ = this.loadService.isWait$

	ngOnInit() {
		this.stepService.stepNum$.subscribe(step => {
			this.step = step;
			this.step === 1 ? this.clearImgData() : null;
		})
		// this.locationForm = this.createLocationForm()

		const files$ = this.uploadService.storyFilesToUpload$.pipe(
			tap((f) => f.length === 0 ? this.activeDumpSubj$.next(false) : this.activeDumpSubj$.next(true)),
			filter((f, idx) => f.length > 0 && idx >= 0),
			// distinctUntilKeyChanged('file.name'),
			catchError(err => throwError(err)),
			takeUntil(this.destroyed$),
			tap(files => console.log(files)),
			share(),
		)

		const getMetadata$ = (storyData: IStoryFile[]) => {
			const mediaType = storyData[0].type!
			console.log(mediaType)
			return this.uploadService.getMetadata$(storyData, mediaType, true).pipe(
				filter(meta => meta instanceof Array ? meta.length > 0 : !!meta),
				map(meta => meta instanceof Array ? meta : [meta]),
				take(1),
				retry(1),
				debounceTime(1000),
				catchError((err) => {
					console.log(err)
					return of(err)
				})
			)
		}

		const getGeoLocation$ = (meta: MetadataResponse[]) => {
			let reqs: Observable<IGeoLocation>[] = [];
			if (meta.length > 0) {
				for (let [idx, val] of meta.entries()) {
					const { lat, lng } = val.meta
					if (lat && lng) {
						reqs = [...reqs, this.locationService.getAddressByLatLng$({ lat, lng })]
					}
				}
			}
			return forkJoin(reqs).pipe(
				catchError(() => of({ locationText: `No location found` } as IGeoLocation)),
				tap(v => console.log(v)),
				map(res => res instanceof Array ? res : [res]),
			)
		}

		this.data$ = files$.pipe(
			// distinctUntilKeyChanged('file.name' as any),
			mergeMap(files => getMetadata$(files).pipe(
				catchError(err => {
					console.error(err)
					return of(err)
				}),
				mergeMap(meta => getGeoLocation$(meta).pipe(
					tap(() => console.log(meta)),
					map(location => ({ files, meta, location })),
				)),
			)),
			map((values) => values.files.map((v, idx) => ({
				// ...v,
				file: values.files[idx].file,
				location: values.location[idx],
				thumbnail: values.meta[idx].thumbnail,
				meta: values.meta[idx].meta,
				error: values.meta[idx].err ? values.meta[idx].err : undefined,
				type: v.type,
			}))),
			startWith([]),
			catchError((err, caught) => {
				console.error(err)
				return caught
			}),
			tap(d => this.uploadService.setFinal(d))
		)

		// this.data$ = this.uploadService.finalFiles$

		this.storyForm = this.createStoryForm()

		this.storyForm.valueChanges
			.pipe(takeUntil(this.destroyed$))
			.subscribe((info) => {
				// console.log(info)
				this.storyInfoFormVal = info;
			})

		// ! WARN: To test
		// this.setStep(2)
	}

	ngOnDestroy() {
		this.destroyed$.next()
		this.destroyed$.unsubscribe()
	}

	compareFn(a: IStoryFile[], b: IStoryFile[]): boolean {
		for (const [idx, prev] of a.entries()) {
			for (const [idx, curr] of a.entries()) {
				if (prev.file.name === curr.file.name) {
					return false
				}
			}
		}
		return true
	}

	// perc = (x[i] / sum) * 100;
	uploadStory(storyData: IStoryFile[], user: IProUser) {
		const mediaType = storyData[0].type!
		const story = new Story(mediaType, user.userId, this.storyInfoFormVal, storyData)
		const storageArray = this.uploadService.storageUpload$(story)
		const dialogRef = this.dialogService.openDialog(UploadDialogComponent, { isLoading: true, progress: 1 })
		const storyRequest$ = this.uploadService.postByrdStoryPropeties$(story)

		const storage$ = merge(storageArray).pipe(
			mergeAll(),
			exhaustMap((p) => {
				console.log(`File is ${p?.toFixed(2)}% uploaded so im waiting`)
				this.dialogService.setDialogData({ progress: Number(p?.toFixed(2)), isLoading: true })
				return of(p)
			}),
			reduce((acc, curr) => acc! + curr!)
		)

		storage$.pipe(
			retry(2),
			switchMap(() => storyRequest$),
			catchError(err => {
				const msg = err.message_ ? err.message_ : err
				console.log(err)
				dialogRef.close()
				alert(msg) // ! find some toast msg / snackbar
				return throwError(err)
			}),
			finalize(() => {
				dialogRef.close()
				this.setStep(3)
			}),
			take(storyData.length),
		)
			.subscribe((res) => {
				console.log(res)
				this.uploadService.nextFilesUploadsArray([])
				// this.activeDumpSubj$.next(false)
				this.dialogService.setDialogData({
					isLoading: false,
					progress: 100,
					status: res.statusCode,
				})
			})

	}

	// verifyMissingStoryData(meta: MetadataResponse[], storyArr: IStoryFile[]) {
	// 	const requiredKeys = ['pixelXDimension', 'pixelYDimension', 'lat', 'lng', 'date']
	// 	const missingKeys: string[] = []
	// 	const geoExistsArr: { lat: number, lng: number }[] = [];
	// 	for (let i = 0; i < meta.length; i++) {
	// 		for (let j = 0; j < requiredKeys.length; j++) {
	// 			// const obj: Object = x[i].data ? x[i].data : x[i].err;
	// 			if (has(meta[i], 'err')) {
	// 				missingKeys.push(requiredKeys[j])
	// 				// storyArr[i].EXIF!.err.msg = `EXIF key ${requiredKeys[j]} missing`
	// 				continue;
	// 			}
	// 		}
	// 		if (has(meta[i].meta, 'lat') && has(meta[i].meta, 'lng')) {
	// 			console.log('bugged')
	// 			// const { lat, lng } = x[i].exif[i];
	// 			// geoExistsArr.push({ lat, lng })
	// 		}
	// 	}

	// 	this.uploadSrv.nextFilesUploadsArray(storyArr)
	// 	this.locationSrv.setLocations(geoExistsArr)
	// 	console.log('missingKeys?: ', missingKeys)
	// }

	// * interface IStoryValueOptions
	createStoryForm() {
		return this.fb.group({
			storyHeadline: ['', Validators.compose([
				Validators.minLength(15),
				Validators.maxLength(40),
				Validators.required,
				// Validators.pattern(specCharRegex)
			])],
			storyDescription: ['', Validators.compose([
				Validators.maxLength(40),
				// Validators.pattern(specCharRegex)
			])],
			assignmentId: [''],
			isExclusive: [false],
			storyPrice: [0],
		})
	}

	// createLocationForm() {
	// 	return this.fb.group({
	// 		place: ['', Validators.compose([
	// 			Validators.maxLength(200)
	// 		])]
	// 	})
	// }

	navigateTo(path: string) {
		window.location.reload()
	}

	clearImgData() {
		// this.exif$ = of([])
		this.locationService.setLocations([])
	}

	setStep(num: number) {
		this.stepService.setStep(num)
	}

}
