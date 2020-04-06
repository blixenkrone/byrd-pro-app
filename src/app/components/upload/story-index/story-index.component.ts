import { Component, OnInit, Input, Output, EventEmitter, InjectionToken, ChangeDetectionStrategy } from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { UploadService, IGeoLocation, LocationService, IGeocodingPlace, IGeoCoordinates } from 'src/app/components/upload/upload.service';
import { IStep } from 'src/app/shared/stepper/stepper.component';
import { IStoryFile, MetadataResponse, IMetadata, requiredKeysMissing } from '../upload.types';
import { FormGroup } from '@angular/forms';
import { has } from 'lodash';

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
export class StoryIndexComponent implements OnInit {
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

	constructor(private uploadSrv: UploadService) { }

	ngOnInit() { }

	// * unsubscribe to the stuff
	// ngOnDestroy() { /**this.destroyed$.next(); this.destroyed$.unsubscribe(); */ }

	dragFile(event: CdkDragDrop<IStoryFile[]>) {
		const src = this.data;
		moveItemInArray(src, event.previousIndex, event.currentIndex);
		// this.uploadSrv.nextFilesUploadsArray(this.data)
	}

	removeStory(story: IStoryFile, idx: number) {
		if (this.data.includes(story, idx) && this.data.indexOf(story) > -1) {
			this.data.splice(idx, 1)
		}
		console.log(this.data)
		this.uploadSrv.nextFilesUploadsArray(this.data)
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
		return `un-verified: ${missingKeys?.join(", ")}`
	}

	previewSource = (thumbnail: string) => {
		if (thumbnail && thumbnail.length > 0) {
			return `data:image/jpeg;base64,${thumbnail}`
		}
		console.log('placeholder')
		return `src/assets/placeholder_video.svg`;
	}

}
