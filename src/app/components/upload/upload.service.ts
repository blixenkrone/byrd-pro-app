import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment.dev';
import { Observable, BehaviorSubject, Subject, of, throwError, from, merge, concat, forkJoin, defer, } from 'rxjs';
import { HttpClient, HttpParams, HttpHeaders, HttpRequest, HttpEventType } from '@angular/common/http';
import { MetadataResponse, IStoryFile, parseFileSuffix, Story, IStoryUploadResponse, IStoryUploadBody } from './upload.types';
import { Params } from '@angular/router';
import { map, tap, switchMap, mergeMap, mergeAll, take, concatMap, reduce, timeoutWith, filter, finalize, concatAll } from 'rxjs/operators';
import { AngularFireStorage, AngularFireUploadTask } from '@angular/fire/storage';
import { uuid } from 'uuidv4';

@Injectable({
	providedIn: 'root'
})
export class UploadService {

	private timeoutUploadThreshold = 60000

	constructor(
		private afStorage: AngularFireStorage,
		private http: HttpClient) { }

	private clearExifEvt$ = new Subject<boolean>();

	private _filesSubj$ = new BehaviorSubject<IStoryFile[]>([]);
	public storyFilesToUpload$ = this._filesSubj$.asObservable()

	private _final$ = new BehaviorSubject<IStoryFile[]>([])
	public finalFiles$ = this._final$.asObservable()

	setFinal(files: IStoryFile[]) {
		this._final$.next(files)
	}

	nextFilesUploadsArray(files: IStoryFile[]) {
		this._filesSubj$.next(files)
	}

	clearExifEvent$() {
		this.clearExifEvt$.next(true)
	}

	public getMetadata$(stories: IStoryFile[], type: 'image' | 'video', preview: boolean): Observable<MetadataResponse[]> {
		const params = new HttpParams().set('preview', String(preview))
		const url = `${environment.proApiUrl}/meta/${type}`
		switch (type) {
			case 'image':
				const formData = new FormData()
				for (const s of stories) {
					formData.append('file', s.file, s.file.name)
				}
				return this.http.post<MetadataResponse[]>(url, formData, { params })
			case 'video':
				const file = stories[0].file
				const headers = new HttpHeaders().set('Content-Type', file.type)
				return this.http.post<MetadataResponse[]>(url, file, { params, headers })
			default:
				alert('no media type defined')
				return throwError('no media type defined')
		}
	}

	/**
	 * @param files
	 * @param uid
	 */
	public storageUpload$(story: Story) {
		let afRefs: Observable<number | undefined>[] = [];
		for (let i = 0; i < story.files().length; i++) {
			const file = story.file(i)
			const fileName = file.name === '' ? Error('No file name determined from file') : file.name;
			if (fileName instanceof Error) {
				throw Error(fileName.message)
			}
			const { suffix } = parseFileSuffix(fileName)
			const path = story.storageRefSalt(story.userId, suffix, story.currUUIDv4(i))
			// Generate a new mediaSource as a uuidv4
			// * Create a firebase storage upload array of each file
			const ref = this.afStorage.upload(path, file)
			const percentChanged = ref.percentageChanges()
			afRefs = [...afRefs, percentChanged]
		}
		return afRefs
	}

	/**
	 * This request must happen after the storageUpload has finished upload the raw files
	 * @param story
	 */
	public postByrdStoryPropeties$(story: Story) {
		const body: IStoryUploadBody = story.createStoryByrdAPI()
		const url = `${environment.byrdApiUrl}/stories/upload`;
		return this.http.post<IStoryUploadResponse>(url, body)
		// const req = new HttpRequest('POST', url, body)
		// return this.http.request<IStoryUploadResponse>(req)
		// description, jeadline .asdøæa.sdasd.
		// server recieves request
		// server parses request 20% of data
		// database
		// gives response < ikke håndtere
		// ....
		// creates thumb previews....
	}
}

/**
 * GEOLOCATION SERVICES
 */

// Response from byrd API lat/lng req.
export interface IGeoLocation {
	locationAddress: string;
	locationCity: string;
	locationCountry: string;
	locationText: string; // * use this one for full string
}

export interface IGeoCoordinates {
	lat: number;
	lng: number;
}

// Reponse from Byrdd API /geocoding/places?place=${query}
export interface IGeocodingPlace {
	// * hits: {}[] containing results but receive this interface as array instead
	place_name: string;
	center: [number, number];
}

@Injectable({
	providedIn: 'root'
})
export class LocationService {
	// * call next on this to receive values and set a global var as = this....asObservable() to async pipe it
	constructor(private http: HttpClient) { }

	private geoSubj$ = new Subject<IGeoCoordinates[]>();
	geoCoordinates$ = this.geoSubj$.asObservable()
	// private locSubj$ = new Subject<string>();
	// locationQuery$ = this.locSubj$.asObservable();

	// setQuery = (query: string) => this.locSubj$.next(query);
	setLocations = (locs: IGeoCoordinates[]) => this.geoSubj$.next(locs)

	public getAddressByLatLng$(geo: IGeoCoordinates): Observable<IGeoLocation> {
		return this.http.get(`${environment.byrdApiUrl}/geocoding`, { params: geo as Params }) as Observable<IGeoLocation>
	}

	public getLatLngByAddress$(place: string): Observable<IGeocodingPlace[]> {
		console.log(place)
		return this.http.get(`${environment.byrdApiUrl}/geocoding/places`, { params: place as any }).pipe(
			map((v: any) => v.hits),
		)
	}

}
