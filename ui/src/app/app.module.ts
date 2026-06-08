import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { V2HostComponent } from './v2-host/v2-host.component';
import { LegacyPageComponent } from './legacy/legacy-page.component';

@NgModule({
  declarations: [
    AppComponent,
    V2HostComponent,
    LegacyPageComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
