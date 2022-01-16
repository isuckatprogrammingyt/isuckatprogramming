import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {AppComponent} from './app.component';
import {Wordle} from './wordle.component';

@NgModule({
  declarations: [
    AppComponent,
    Wordle,
  ],
  imports: [BrowserModule],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
