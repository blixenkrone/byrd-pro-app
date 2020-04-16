import { IGeoLocation, IGeoCoordinates } from './upload.service';
import { EMediaType } from 'src/app/core/models/media.model';
import * as md5 from 'md5';
import { uuid } from 'uuidv4'
import { isNil } from 'lodash';
import { KeyValue } from '@angular/common';

/**
 * parses a filename as a string to get the suffix in lowercase
 * @param fileName
 */
export const parseFileSuffix = (fileName: string): { suffix: string } => {
	return { suffix: fileName.toLowerCase().split('.').pop()! }
}

const _requiredStoryKeys = ['width', 'height', 'lat', 'lng', 'date'];

type ModelName = string

/**
 * key: true === the key is missing
 */
type RequiredKeyMissing<T> = {
	width: T;
	height: T;
	location: T;
	date: T;
	model?: T;
}

type StoryIndex = number;

/**
 *
 * @param missings
 * returns exactly what keys are required for uploading the story and discards the rest
 */
export const requiredKeysMissing = (missings: string[]): string[] | null => {
	let out: string[] = [];
	for (let i = 0; i < _requiredStoryKeys.length; i++) {
		if (missings.length > 0) {
			for (let j = 0; j < missings.length; j++) {
				if (missings[j] === _requiredStoryKeys[i]) {
					out = [...out, missings[j]]
				}
			}
		}
	}
	return out.length > 0 ? out : null;
}

interface IStoryBody {
	// _uuidv4: string[];
	storageRefSalt: (userId: string, suffix: string, uuidv4: string) => string
	createStoryByrdAPI(uuids: string[]): IStoryUploadBody
	files(): File[]
	requiredKeys(): Map<StoryIndex, string>
}

export class Story implements IStoryBody {

	constructor(
		private _mType: EMediaType,
		private _userId: string,
		private _storyText: IStoryValueOptions,
		private _storyData: IStoryFile[]) {
		this._uuidv4 = this.generateUIDArray()
	}

	private readonly _uuidv4!: string[];

	get userId(): string {
		return this._userId;
	}

	public currUUIDv4(idx: number) {
		return this._uuidv4[idx]
	}

	generateUIDArray = (): string[] => {
		const u: string[] = []
		for (let i = 0; i < this.filesLength(); i++) {
			u[i] = uuid()
		}
		return u
	}

	/**
	 *
	 * @param uuid same as the uuidv4 used in storage ref path
	 */
	public createStoryByrdAPI(): IStoryUploadBody {
		let medias: IStoryMediaProps[] = [];
		for (let i = 0; i < this.files().length; i++) {
			const media: IStoryMediaProps = {
				_geoloc: this.geo(i),
				mediaDate: this.date(i),
				mediaExtension: ({ ...parseFileSuffix(this.fileName(i)) }).suffix,
				mediaType: this.mediaType(),
				mediaDevice: this.model(i),
				isVerified: false,
				mediaWidth: this.width(i),
				mediaHeight: this.height(i),
				mediaSize: this.sizeToMB(this.fileSize(i)),
				mediaSource: this.currUUIDv4(i),
			};
			medias = [...medias, media]
		}

		return {
			_geoloc: this.geo(0),
			storyHeadline: this.storyText.storyHeadline,
			storyDescription: this.storyText.storyDescription,
			assignmentId: this.storyText.assignmentId,
			isHash: true,
			isExclusive: this.storyText.isExclusive || false,
			coverId: medias[0].mediaSource,
			media: medias,
		} as IStoryUploadBody;

	}

	/**
	 * files return file array
	 */
	public files() {
		return this.storyData.map(v => v.file)
	}

	public filesLength() {
		return this.storyData.length;
	}

	public file(idx: number) {
		return this.storyData[idx].file
	}

	public sizeToMB(sizeInbytes: number): number {
		return Number((sizeInbytes / 1024 / 1024).toFixed(2))
	}

	/**
 	* creates a reference to firebase storage as the filename to dump
 	* const same_uuidv4 = new uuuidv4
 	* /{uid}/media/same_uuidv4/{md5(userId + same_uuidv4)}.{ext}
 	* mediaSource: same_uuidv4
 	* @param uid
 	* @param fileSuffix
	*/
	public storageRefSalt = (userId: string, suffix: string, uuidv4: string) => {
		console.log(uuidv4)
		return `${userId}/media/${uuidv4}/${md5(userId + uuidv4)}.${suffix}`
	}

	// returns [array index:key missing] for required story keys to proceed to step #2
	public requiredKeys(): Map<StoryIndex, string> {
		const missings = new Map<StoryIndex, string>();
		for (let i = 0; i < this.storyData.length; i++) {
			const checked: RequiredKeyMissing<boolean> = {
				width: isNaN(this.width(i)),
				height: isNaN(this.height(i)),
				location: isNil(this.geo(i)),
				date: isNaN(this.date(i)),
			}
			Object.entries(checked).filter(([key, missing]) => {
				if (missing) {
					missings.set(i, key)
				}
			})
		}
		return missings;
	}

	get storyData() {
		return this._storyData;
	}

	get storyText() {
		return this._storyText
	}

	private mediaType(): EMediaType {
		return this._mType
	}

	// ! width height should find adjacent values as date maybe
	private width(idx: number) {
		const w = this.storyData[idx].meta?.width
		if (w !== undefined) {
			return w
		}
		return 0
	}

	private height(idx: number) {
		const h = this.storyData[idx].meta?.height
		if (h !== undefined) {
			return h
		}
		return 0
	}

	private fileName(idx: number): string {
		return this.file(idx).name
	}

	private fileSize(idx: number): number {
		return this.file(idx).size
	}

	private model(idx: number): ModelName {
		const model = this.storyData[idx].meta?.model
		return model === '' || model === undefined ? 'Unknown' : model
	}

	private geo(idx: number): IGeoCoordinates {
		const meta = this.storyData[idx].meta
		if (meta?.lat && meta?.lng) {
			return { lat: meta.lat, lng: meta.lng }
		}
		return { lat: NaN, lng: NaN };
	}

	private date(i: number): number {
		const meta = this.storyData[i].meta
		if (meta?.date !== undefined && meta.date > 0) {
			return meta.date
		} else {
			for (let j = this.storyData.length - 1; j--;) {
				// do {
				if (j === i) { continue }
				if (j === 0) { break }
				if (this.date(j) > 0) {
					return this.date(j)
				}
				// } while (meta?.date === 0 || meta?.date === undefined);
			}
			return NaN
		}
	}




}


/** Fetched from the app-info template in @func getFormVal() - gets user text values to final story upload */
export interface IStoryValueOptions {
	storyHeadline: string;
	storyDescription: string;
	assignmentId: string;
	isExclusive: boolean;
	storyPrice?: number; // in euro
}

// Represents the actual data handling - used in parent/child relation of all upload modules/components
export interface IStoryFile {
	type?: EMediaType;
	file: File;
	/** preview to display in HTML */
	thumbnail?: ArrayBuffer | null;
	meta?: IMetadata;
	location?: IGeoLocation;
}

// response from byrd api after uplooad
export interface IStoryUploadResponse {
	statusResponse: string;
	statusCode: number;
	message: string;
}

// represents final story upload to API
export interface IStoryUploadBody extends IStoryValueOptions {
	_geoloc: IGeoCoordinates;
	isHash: true; // requires to define correct filereference in storage: `md5(uid + new(uuidv4)).{ext}`
	coverId: string; // media.mediaSource[0]
	media: IStoryMediaProps[];
}

interface IStoryMediaProps {
	_geoloc: IGeoCoordinates;
	mediaDate: Date | number;
	mediaExtension: string; // jpeg, png, mp4
	mediaType: EMediaType;
	mediaDevice: string;
	isVerified: false;
	mediaWidth: number;
	mediaHeight: number;
	mediaSize: number;
	mediaSource: string; // uuidv4
	// arrBuffer?: Buffer | string;
}


export interface IMetadata {
	copyright?: string; // only one NOT needed
	model?: string; // camera model
	date: number;
	lat: number;
	lng: number;
	width: number;
	height: number;
	mediaSize: number;
	missingExif?: string[]
}

// Pro API metadata response
export interface IMetadataResponse {
	meta: IMetadata;
	thumbnail: (ArrayBuffer | any);
	err?: any | { msg: string };
}

export interface IMediaApiResponse {

}
