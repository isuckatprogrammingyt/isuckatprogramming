import {Component, ElementRef, HostListener, QueryList, ViewChild, ViewChildren} from '@angular/core';

import {WORDS} from './words';

// Lenght of the word.
const WORD_LENGTH = 5;

// Number of tries.
const NUM_TRIES = 6;

// Letter map.
const LETTERS = (() => {
  // letter -> true. Easier to check.
  const ret: {[key: string]: boolean} = {};
  for (let charCode = 97; charCode < 97 + 26; charCode++) {
    ret[String.fromCharCode(charCode)] = true;
  }
  return ret;
})();

// One try.
interface Try {
  letters: Letter[];
}

// One letter in a try.
interface Letter {
  text: string;
  state: LetterState;
}

enum LetterState {
  // you know.
  WRONG,
  // letter in word but position is wrong.
  PARTIAL_MATCH,
  // letter and position are all correct.
  FULL_MATCH,
  // before the current try is submitted.
  PENDING,
}

@Component({
  selector: 'wordle',
  templateUrl: './wordle.component.html',
  styleUrls: ['./wordle.component.scss'],
})
export class Wordle {
  @ViewChildren('tryContainer') tryContainers!: QueryList<ElementRef>;

  // Stores all tries.
  // One try is one row in the UI.
  readonly tries: Try[] = [];

  // This is to make LetterState enum accessible in html template.
  readonly LetterState = LetterState;

  // Keyboard rows.
  readonly keyboardRows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Enter', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Backspace'],
  ];

  // Stores the state for the keyboard key indexed by keys.
  readonly curLetterStates: {[key: string]: LetterState} = {};

  // Message shown in the message panel.
  infoMsg = '';

  // Controls info message's fading-out animation.
  fadeOutInfoMessage = false;

  showShareDialogContainer = false;
  showShareDialog = false;

  // Tracks the current letter index.
  private curLetterIndex = 0;

  // Tracks the number of submitted tries.
  private numSubmittedTries = 0;

  // Store the target word.
  private targetWord = '';

  // Won or not.
  private won = false;

  // Stores the count for each letter from the target word.
  //
  // For example, if the target word is "happy", then this map will look like:
  //
  // { 'h':1, 'a': 1, 'p': 2, 'y': 1 }
  private targetWordLetterCounts: {[letter: string]: number} = {};

  constructor() {
    // Populate initial state of "tries".
    for (let i = 0; i < NUM_TRIES; i++) {
      const letters: Letter[] = [];
      for (let j = 0; j < WORD_LENGTH; j++) {
        letters.push({text: '', state: LetterState.PENDING});
      }
      this.tries.push({letters});
    }

    // Get a target word from the word list.
    const numWords = WORDS.length;
    while (true) {
      // Randomly select a word and check if its length is WORD_LENGTH.
      const index = Math.floor(Math.random() * numWords);
      const word = WORDS[index];
      if (word.length === WORD_LENGTH) {
        this.targetWord = word.toLowerCase();
        break;
      }
    }
    // Print it out so we can cheat!:)
    console.log('target word: ', this.targetWord);

    // Generate letter counts for target word.
    for (const letter of this.targetWord) {
      const count = this.targetWordLetterCounts[letter];
      if (count == null) {
        this.targetWordLetterCounts[letter] = 0;
      }
      this.targetWordLetterCounts[letter]++;
    }
    console.log(this.targetWordLetterCounts);
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    this.handleClickKey(event.key);
  }

  // Returns the classes for the given keyboard key based on its state.
  getKeyClass(key: string): string {
    const state = this.curLetterStates[key.toLowerCase()];
    switch (state) {
      case LetterState.FULL_MATCH:
        return 'match key';
      case LetterState.PARTIAL_MATCH:
        return 'partial key';
      case LetterState.WRONG:
        return 'wrong key';
      default:
        return 'key';
    }
  }

  handleClickKey(key: string) {
    // Don't process key down when user has won the game.
    if (this.won) {
      return;
    }

    // If key is a letter, update the text in the corresponding letter object.
    if (LETTERS[key.toLowerCase()]) {
      // Only allow typing letters in the current try. Don't go over if the
      // current try has not been submitted.
      if (this.curLetterIndex < (this.numSubmittedTries + 1) * WORD_LENGTH) {
        this.setLetter(key);
        this.curLetterIndex++;
      }
    }
    // Handle delete.
    else if (key === 'Backspace') {
      // Don't delete previous try.
      if (this.curLetterIndex > this.numSubmittedTries * WORD_LENGTH) {
        this.curLetterIndex--;
        this.setLetter('');
      }
    }
    // Submit the current try and check.
    else if (key === 'Enter') {
      this.checkCurrentTry();
    }
  }

  handleClickShare() {
    // 🟩🟨⬜
    // Copy results into clipboard.
    let clipboardContent = '';
    for (let i = 0; i < this.numSubmittedTries; i++) {
      for (let j = 0; j < WORD_LENGTH; j++) {
        const letter = this.tries[i].letters[j];
        switch (letter.state) {
          case LetterState.FULL_MATCH:
            clipboardContent += '🟩';
            break;
          case LetterState.PARTIAL_MATCH:
            clipboardContent += '🟨';
            break;
          case LetterState.WRONG:
            clipboardContent += '⬜';
            break;
          default:
            break;
        }
      }
      clipboardContent += '\n';
    }
    console.log(clipboardContent);
    navigator.clipboard.writeText(clipboardContent);
    this.showShareDialogContainer = false;
    this.showShareDialog = false;
    this.showInfoMessage('Copied results to clipboard');
  }

  private setLetter(letter: string) {
    const tryIndex = Math.floor(this.curLetterIndex / WORD_LENGTH);
    const letterIndex = this.curLetterIndex - tryIndex * WORD_LENGTH;
    this.tries[tryIndex].letters[letterIndex].text = letter;
  }

  private async checkCurrentTry() {
    // Check if user has typed all the letters.
    const curTry = this.tries[this.numSubmittedTries];
    if (curTry.letters.some(letter => letter.text === '')) {
      this.showInfoMessage('Not enough letters');
      return;
    }

    // Check if the current try is a word in the list.
    const wordFromCurTry =
        curTry.letters.map(letter => letter.text).join('').toUpperCase();
    if (!WORDS.includes(wordFromCurTry)) {
      this.showInfoMessage('Not in word list');
      // Shake the current row.
      const tryContainer =
          this.tryContainers.get(this.numSubmittedTries)?.nativeElement as
          HTMLElement;
      tryContainer.classList.add('shake');
      setTimeout(() => {
        tryContainer.classList.remove('shake');
      }, 500);
      return;
    }

    // Check if the current try matches the target word.

    // Stores the check results.

    // Clone the counts map. Need to use it in every check with the initial
    // values.
    const targetWordLetterCounts = {...this.targetWordLetterCounts};
    const states: LetterState[] = [];
    for (let i = 0; i < WORD_LENGTH; i++) {
      const expected = this.targetWord[i];
      const curLetter = curTry.letters[i];
      const got = curLetter.text.toLowerCase();
      let state = LetterState.WRONG;
      // Need to make sure only performs the check when the letter has not been
      // checked before.
      //
      // For example, if the target word is "happy", then the first "a" user
      // types should be checked, but the second "a" should not, because there
      // is no more "a" left in the target word that has not been checked.
      if (expected === got && targetWordLetterCounts[got] > 0) {
        targetWordLetterCounts[expected]--;
        state = LetterState.FULL_MATCH;
      } else if (
          this.targetWord.includes(got) && targetWordLetterCounts[got] > 0) {
        targetWordLetterCounts[got]--
        state = LetterState.PARTIAL_MATCH;
      }
      states.push(state);
    }
    console.log(states);

    // Animate.
    // Again, there must be a more angular way to do this, but...

    // Get the current try.
    const tryContainer =
        this.tryContainers.get(this.numSubmittedTries)?.nativeElement as
        HTMLElement;
    // Get the letter elements.
    const letterEles = tryContainer.querySelectorAll('.letter-container');
    for (let i = 0; i < letterEles.length; i++) {
      // "Fold" the letter, apply the result (and update the style), then unfold
      // it.
      const curLetterEle = letterEles[i];
      curLetterEle.classList.add('fold');
      // Wait for the fold animation to finish.
      await this.wait(180);
      // Update state. This will also update styles.
      curTry.letters[i].state = states[i];
      // Unfold.
      curLetterEle.classList.remove('fold');
      await this.wait(180);
    }

    // Save to keyboard key states.
    //
    // Do this after the current try has been submitted and the animation above
    // is done.
    for (let i = 0; i < WORD_LENGTH; i++) {
      const curLetter = curTry.letters[i];
      const got = curLetter.text.toLowerCase();
      const curStoredState = this.curLetterStates[got];
      const targetState = states[i];
      // This allows override state with better result.
      //
      // For example, if "A" was partial match in previous try, and becomes full
      // match in the current try, we update the key state to the full match
      // (because its enum value is larger).
      if (curStoredState == null || targetState > curStoredState) {
        this.curLetterStates[got] = targetState;
      }
    }

    this.numSubmittedTries++;

    // Check if all letters in the current try are correct.
    if (states.every(state => state === LetterState.FULL_MATCH)) {
      this.showInfoMessage('NICE!');
      this.won = true;
      // Bounce animation.
      for (let i = 0; i < letterEles.length; i++) {
        const curLetterEle = letterEles[i];
        curLetterEle.classList.add('bounce');
        await this.wait(160);
      }
      this.showShare();
      return;
    }

    // Running out of tries. Show correct answer.
    //
    // If you can hear, my heater is on.. sorry about that!
    if (this.numSubmittedTries === NUM_TRIES) {
      // Don't hide it.
      this.showInfoMessage(this.targetWord.toUpperCase(), false);
      this.showShare();
    }
  }

  private showInfoMessage(msg: string, hide = true) {
    this.infoMsg = msg;
    if (hide) {
      // Hide after 2s.
      setTimeout(() => {
        this.fadeOutInfoMessage = true;
        // Reset when animation is done.
        // Sorry, little bit hacky here.
        setTimeout(() => {
          this.infoMsg = '';
          this.fadeOutInfoMessage = false;
        }, 500);
      }, 2000);
    }
  }

  private async wait(ms: number) {
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, ms);
    })
  }

  private showShare() {
    setTimeout(() => {
      this.showShareDialogContainer = true;
      // Wait a tick till dialog container is displayed.
      setTimeout(() => {
        // Slide in the share dialog.
        this.showShareDialog = true;
      });
    }, 1500);
  }
}
