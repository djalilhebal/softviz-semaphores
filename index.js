//@ts-check
/**
 * Utility function
 * 
 * @param {Array} arrA
 * @param {Array} arrB
 * @returns {Object}
 */
function zipObject(arrA, arrB) {
  const zip = (arrX, arrY) => arrX.map((x, i) => [x, arrY[i]]);
  return Object.fromEntries(zip(arrA, arrB));
}

/**
 * A basic Promise-based and queue-based Semaphore
 */
const Semaphore = class SillySemaphore {

  constructor(permits) {
    this._permits = permits;
    this._queue = [];
  }

  getPosition(acquirer) {
    const idx = this._queue.findIndex(entry => entry.acquirer === acquirer);
    return idx + 1; // to get rid of '-1'
  }

  async acquire(acquirer) {
    return new Promise( (resolve, reject) => {
      this._queue.push({
        acquirer,
        resolve,
        reject
      });
      this._maybeNotify();
    });
  }

  async release(_acquirer) {
    this._permits++;
    this._maybeNotify();
  }

  /**
   * Reject all pending promises and nullify the 'queue'
   *   so that future calls fail...
   */
  die() {
    let entry;
    while (entry = this._queue.pop()) {
      entry.reject();
    }
    this._queue = null;
  }

  _maybeNotify() {
    if (this._permits > 0) {
      const entry = this._queue.shift();
      if (entry) {
        this._permits--;
        entry.resolve();
      }
    }
  }

}


class Sim {

  static userVars = {};
  static userAlgos = {};

  static ctrl  = null;
  static lane1 = [];
  static lane2 = [];
  static crossing = 0;

  static ui = {};
  static creatorInterval = null;

  static start() {
    // if (Sim.ui.$sim === undefined) Sim.resetUI();

    Sim.clearErrors();
    Sim.loadUserInputs();
    Sim.ui.$fieldset.disabled = true;
    Sim.ctrl = new Controller();
    Sim.ctrl.run();
    Sim.initCreator();
    Sim.redraw();
  }

  static stop() {
    function freezeSimUI() {
      // To replace all elements so no one can alter the current state
      Sim.ui.$sim.outerHTML = Sim.ui.$sim.outerHTML;
      // To signal that they no longer reference actual DOM elements and free them maybe(?)
      Sim.ui = {};
    }

    function freeVariables() {
      // Kill all user defined semaphores
      Object.entries(Sim.userVars)
        .map(entry => entry[1])
        .filter(val => val instanceof Semaphore)
        .forEach(sema => sema.die());

      Sim.userVars = {};
    }

    function freeThreads() {
      // TODO:
      // - kill "threads" (maybe simply call .destory() of each existing Traverser)
      // - cancel Controller 'ctrl' (AFAIK you can not cancel Promises...)
    }

    Sim.ui.$fieldset.disabled = false;
    clearInterval(Sim.creatorInterval);
    freezeSimUI();
    //freeThreads();
    //freeVariables();
  }

  static setup() {
    const $ = str => document.querySelector(str);

    Object.assign(Sim.ui, {
      $form: $('form'),
      $fieldset: $('form fieldset'),
      $semaNames: $('#sema-names'),
      $semaVals: $('#sema-vals'),
      $intNames: $('#int-names'),
      $intVals: $('#int-vals'),
      $controller: $('#controller'),
      $traverser1: $('#traverser1'),
      $traverser2: $('#traverser2'),

      $sim: $('#sim'),
      $intersection: $('#intersection'),
    })

    Sim.ui.$form.onsubmit = (ev) => {
      ev.preventDefault();
      Sim.start();
    }

    $('#btn-load-attempt').onclick = (ev) => {
      ev.preventDefault();
      Sim.loadPreset(Sim.presets.myAttempt);
    }

    $('#btn-load-correct').onclick = (ev) => {
      ev.preventDefault();
      Sim.loadPreset(Sim.presets.correctAnswer);
    }

  }
  
  static loadUserInputs() {
    const {ui} = Sim;

    // userAlgos...
    Object.assign(Sim.userAlgos,
      {
        controller: ui.$controller.value,
        traverser1: ui.$traverser1.value,
        traverser2: ui.$traverser2.value,
      }
    )

    // userVars...
    const SEP = /,\s*/; // separator

    const userSemas = zipObject(
      ui.$semaNames.value.split(SEP),
      ui.$semaVals.value.split(SEP).map(val => new Semaphore(Number(val)))
    );

    const userInts = zipObject(
      ui.$intNames.value.split(SEP),
      ui.$intVals.value.split(SEP).map(val => Number(val))
    );

    Object.assign(Sim.userVars, userSemas, userInts);
  }

  static initCreator() {
    // maybe create a new instance of Traverser every second
    Sim.creatorInterval = setInterval(Sim.maybeCreateTraverser, 1 * 1000);
  }

  /**
   * Maybe create a new instance of Traverser and run it
   * @returns {Traverser} The newly created traverser or null.
   */
  static maybeCreateTraverser() {
    // maybe not
    if (Math.random() < 0.5) {
      return null;
    }

    if (Math.random() < 0.5) {
      if (Sim.lane1.length < Traverser1.MAX) {
        const t1 = new Traverser1();
        Sim.lane1.push(t1);
        t1.run();
        return t1;
      }
    } else {
      if (Sim.lane2.length < Traverser2.MAX) {
        const t2 = new Traverser2();
        Sim.lane2.push(t2);
        t2.run();
        return t2;
      }
    }

    // no room for a new 'Traverser' in the randomly chosen 'lane'
    return null;
  }

  static redraw() {
    // Just update 'data-*' and '--pos' values, and let CSS take care of the rest.

    // Traffic light
    const {ui, ctrl, userVars} = Sim;
    ui.$sim.dataset.light = userVars.light;
    ui.$sim.dataset.ctrlQueued = ctrl.orderVec.some(sema => userVars[sema].getPosition(ctrl) > 0);

    // Lanes
    const {lane1, lane2, redrawTraverser} = Sim;
    lane1.sort(Traverser.compareTraversers);
    lane2.sort(Traverser.compareTraversers);
    lane1.forEach(redrawTraverser);
    lane2.forEach(redrawTraverser);

    // FIXME: Maybe it's better to use Proxy(userVars) and redraw after its attributes are accessed..
    // Redraw before each repaint
    requestAnimationFrame(Sim.redraw);
  }

  /**
   * Update Traverser
   * 
   * @param {Traverser} t 
   * @param {number} i - index 
   */
  static redrawTraverser(t, i) {
    t.$elem.style.setProperty('--pos', i);
    t.$elem.title =
      `${t.name}\n\n` +
      `orderVec: {${t.orderVec.join(', ')}}\n` +
      `waitVec: {${t.getWaitVec().join(', ')}}`;
  }

  static showError(algoSource, message) {
    Sim.ui[ '$' + algoSource ].setAttribute('title', message);
    Sim.stop();
  }

  static clearErrors() {
    Sim.ui.$form.querySelectorAll('[title]').forEach($x => $x.removeAttribute('title'));
  }

  /**
   * Populate UI inputs with preset data
   * 
   * @param {object} preset
   */
  static loadPreset(preset) {
    const keys = 'semaNames semaVals intNames intVals controller traverser1 traverser2'.split(' ');
    for (const key of keys) {
      Sim.ui['$' + key].value = preset[key];
    }
  }
}

class Algorithm {

  /**
   * @param {String} algoSource - "controller", "traverser1", or "traverser2"
   */
  constructor(algoSource) {
    this.algoSource = algoSource;
    this.userAlgo   = Sim.userAlgos[algoSource];
    this.orderVec   = Algorithm.parseOrderVector(this.userAlgo);
  }

  async run() {
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    try {
      const asyncFunc = new AsyncFunction(`
        with (Sim.userVars) {
          ${ Algorithm.awaitifyThis(this.userAlgo) }
        }
      `);
      await asyncFunc.call(this);
    } catch (userError) {
      console.error('userError', userError); // for actual debugging
      Sim.showError(this.algoSource, userError.message);
    }
  }

  /**
   * Replace function calls with `await`ed method invocations associated with `this` object.
   * 
   * @param {string} code
   * @returns {string} Updated code
   */
  static awaitifyThis(code) {
    // Prefix "p", "v", "sleep", and "traverse" calls with `await` and attach them to `this`
    return code.replace(/\b(p|v|sleep|traverse)\(/g, 'await this.$1(');
  }

  async p(x) {
    await this.sleep(0);
    await x.acquire(this);
  }

  async v(x) {
    await this.sleep(0);
    await x.release(this);
  }

  async sleep(secs) {
    return new Promise((resolve, _reject) => {
      setTimeout(resolve, secs * 1000);
    });
  }

  /**
   * A vehicle's place in line is determined by a vector of priorities
   * which are based on calls to p(...)
   * 
   * @todo Should dedup before returning?
   * 
   * @param {string} code
   * @return {Array<string>}
   */
  static parseOrderVector(code) {
    const pCalls = code.match(/\bp\(\s*(\w+)\s*\)/g) || [];
    const acquiredSemaphores = pCalls.map(x => x.slice(2, -1).trim());
    return acquiredSemaphores;
  }

}


class Controller extends Algorithm {

  constructor() {
    super('controller');
  }

}


class Traverser extends Algorithm {

  static counter = 0;
  static freeColors = 'blue coral darkkhaki firebrick yellowgreen gray skyblue teal orange pink purple yellow'.split(' ');

  constructor(algoSource) {
    super(algoSource);

    this.id = this.getUniqueId();
    this.color = this.getUniqueColor();
    this.type = Math.random() < 0.25 ? 'truck' : 'car'; // 25% chance of being a truck
    this.name = `${this.color} ${this.type} #${this.id}`;
    this.$elem = null;

    // FIXME: These attributes are set by children
    this.lane = null;
    this.dir = this.algoSource === 'traverser1' ? 'south' : 'west';
    this.initialPos = 'traverser1' ? '4' : '7'; // the very end of the line
  }

  /**
   * Create a new visual element and display it on page
   */
  initElem() {
    this.$elem = document.createElement('span');
    this.$elem.classList.add('vehicle', this.type, this.dir);
    this.$elem.title = this.name; // (will be updated)
    this.$elem.style.setProperty('--pos', this.initialPos); // (will be updated)
    this.$elem.style.setProperty('--color', this.color);
    Sim.ui.$intersection.append(this.$elem);
    return this.$elem; // always return something
  }

  destroyElem() {
    Traverser.freeColors.push(this.color);
    this.$elem.remove();
  }

  destroy() {
    this.destroyElem();
    this.lane.splice(this.lane.findIndex(t => t === this), 1);
  }

  async traverse() {
    // "Restarting the engine takes some time" za3ma
    // Adds an element of "randomness"
    await this.sleep(Math.random());
    // Cross the intersection then "keep moving" and fade away...
    await this.enterIntersection();
    await this.leaveIntersection();
  }

  async enterIntersection() {
    Sim.crossing++;
    this.$elem.dataset.state = 'leaving';
    this.assertNoCollision();
    await this.sleep(0.5);
  }

  async leaveIntersection() {
    await this.sleep(1);
    this.assertNoCollision();
    this.destroy();
    Sim.crossing--;
  }

  assertNoCollision() {
    const happened = Sim.crossing > 1; // more than one vehicle crossing the intersection
    if (happened) {
      Sim.ui.$sim.dataset.state = 'error';
      throw new Error('Collision!');
    }
  }
  
  /**
   * @returns {Array<number>}
   */
  getWaitVec() {
    const vec = this.orderVec.map(semaName => Sim.userVars[semaName].getPosition(this));
    return vec;
  }

  getUniqueId() {
    // FIXME: Should throw error when about to overflow? Althrough this sim won't run for a long time for this to happen
    return (++Traverser.counter).toString(36).toUpperCase();
  }
  
  getUniqueColor() {
    return Traverser.freeColors.shift();
  }

  /**
   * 
   * @param {Traverser} a 
   * @param {Traverser} b 
   * @returns {number}
   */
  static compareTraversers(a, b) {
    return Traverser.compareVecs( a.getWaitVec(), b.getWaitVec() );
  }

  /**
   * Sort wait vecs in an ascending order
   * 
   * @param {Array<number>} vecA
   * @param {Array<number>} vecB
   * @returns {number}
   */
  static compareVecs(vecA, vecB) {
    for (let i = 0; i < vecA.length; i++) {
      if (vecA[i] - vecB[i] !== 0) {
        return vecA[i] - vecB[i];
      }
    }
    return 0;
  }
  
}


class Traverser1 extends Traverser {

  static MAX = 4;

  constructor() {
    super('traverser1');
    this.initElem();
    this.lane = Sim.lane1;
  }

}


class Traverser2 extends Traverser {

  static MAX = 7;

  constructor() {
    super('traverser2');
    this.initElem();
    this.lane = Sim.lane2;
  }
  
}

Sim.setup();
