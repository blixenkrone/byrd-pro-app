import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookingRoutingModule } from './booking-routing.module';
import { ReactiveFormsModule } from '@angular/forms';
import { NgxFileDropModule } from 'ngx-file-drop';
import { BookingComponent } from './booking.component';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
// import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { UploadDialogModule } from 'src/app/shared/upload-dialog/upload-dialog.module';


@NgModule({
	declarations: [
		BookingComponent,
	],
	imports: [
		CommonModule,
		UploadDialogModule,
		BookingRoutingModule,
		NgxFileDropModule,
		ReactiveFormsModule,
		MatSnackBarModule,
		MatProgressSpinnerModule,
		MatProgressBarModule,
		MatIconModule,
		MatDialogModule,
		MatTableModule,
		MatInputModule,
		MatSelectModule,
	],
	// entryComponents: [
	// UploadDialogComponent
	// ]
})
export class BookingModule { }
