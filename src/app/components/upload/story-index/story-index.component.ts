import { Component, OnInit, Input, Output, EventEmitter, InjectionToken, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { CdkDragDrop, moveItemInArray, DragRef } from '@angular/cdk/drag-drop';
import { UploadService, IGeoLocation, LocationService, IGeocodingPlace, IGeoCoordinates } from 'src/app/components/upload/upload.service';
import { IStep } from 'src/app/shared/stepper/stepper.component';
import { IStoryFile, IMetadataResponse, IMetadata, requiredKeysMissing } from '../upload.types';
import { FormGroup } from '@angular/forms';
import { has } from 'lodash';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

export interface LatLngOutput {
	loc: Map<string, number>;
	storyIdx: number;
}

@Component({
	selector: 'app-story-index',
	templateUrl: './story-index.component.html',
	styleUrls: ['./story-index.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoryIndexComponent implements OnInit, OnDestroy {
	@Input() data!: IStoryFile[];
	@Input() mediaType!: 'image' | 'video';
	@Input() step!: number;
	@Input() locationForm!: FormGroup;
	@Input() locationResults!: IGeocodingPlace;
	@Input() isWait!: boolean;

	maxImageFiles = 5;
	maxVideoFiles = 1;

	// @Input() geo!: IGeoCoordinates[];

	@Output() readonly latLng = new EventEmitter<LatLngOutput>();
	destroyed$ = new Subject();

	constructor(
		// private dragRef: DragRef,
		private locationService: LocationService,
		private uploadService: UploadService) { }


	ngOnInit() {
		this.locationForm.valueChanges
			.pipe(takeUntil(this.destroyed$))
			.subscribe((info) => {
				console.log(info)
				this.locationService.getLatLngByAddress$(info).subscribe(v => console.log(v))
			})
	}

	ngOnDestroy() {
		this.destroyed$.next()
		this.destroyed$.unsubscribe()
	}

	// get dragging() {
	// 	return this.dragRef.isDragging()
	// }

	dragFile(event: CdkDragDrop<IStoryFile[]>) {
		// const src = this.data;
		moveItemInArray(this.data, event.previousIndex, event.currentIndex);
		// this.uploadSrv.nextFilesUploadsArray(this.data)
	}

	removeStory(story: IStoryFile, idx: number) {
		if (this.data.includes(story, idx) && this.data.indexOf(story) > -1) {
			this.data.splice(idx, 1)
		}
		console.log(this.data)
		this.uploadService.nextFilesUploadsArray(this.data)
	}
	// click in html
	getLatLng(geo: IGeocodingPlace, storyIdx: number) {
		if (has(geo, 'center')) {
			const loc = new Map<string, number>();
			loc.set('lat', geo.center[1])
			loc.set('lng', geo.center[0])
			this.latLng.emit({ loc, storyIdx })
		}
	}



	missingMetaString = (missing: string[]) => {
		const missingKeys = requiredKeysMissing(missing)
		if (missingKeys) {
			return `un-verified: ${missingKeys?.join(", ")}`
		}
	}

	previewSource = (thumbnail: string) => {
		if (thumbnail && thumbnail.length > 0) {
			return `data:image/jpeg;base64,${thumbnail}`
		}
		console.log('placeholder')
		return `src/assets/placeholder_video.svg`;
	}

}
