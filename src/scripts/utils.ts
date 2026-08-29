/* ---------- Math helpers ---------- */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/* ---------- Perlin noise (2D) ---------- */
export class Perlin {
  private p = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
  private perm = new Array(512);
  private gradP = new Array(512);

  constructor(seed = Math.random() * 255) {
    let s = Math.floor(seed);
    if (s < 256) s |= s << 8;
    for (let i = 0; i < 256; i++) {
      const v = i & 1 ? this.p[i] ^ (s & 255) : this.p[i] ^ ((s >> 8) & 255);
      this.perm[i] = this.perm[i + 256] = v;
      this.gradP[i] = this.gradP[i + 256] = v % 12;
    }
  }
  private static grad3 = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[1,0],[-1,0],[0,1],[0,-1],[0,1],[0,-1]];
  private fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
  perlin2(x: number, y: number) {
    let X = Math.floor(x), Y = Math.floor(y);
    x -= X; y -= Y; X &= 255; Y &= 255;
    const g = Perlin.grad3;
    const n00 = g[this.gradP[X + this.perm[Y]]][0] * x + g[this.gradP[X + this.perm[Y]]][1] * y;
    const n01 = g[this.gradP[X + this.perm[Y + 1]]][0] * x + g[this.gradP[X + this.perm[Y + 1]]][1] * (y - 1);
    const n10 = g[this.gradP[X + 1 + this.perm[Y]]][0] * (x - 1) + g[this.gradP[X + 1 + this.perm[Y]]][1] * y;
    const n11 = g[this.gradP[X + 1 + this.perm[Y + 1]]][0] * (x - 1) + g[this.gradP[X + 1 + this.perm[Y + 1]]][1] * (y - 1);
    const u = this.fade(x), v = this.fade(y);
    return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
  }
}

/* ---------- Char splitting (SplitText replacement) ----------
   Wraps words in .word and chars in .char > .char__inner. Returns chars. */
export function splitChars(words: NodeList | HTMLElement[]): HTMLElement[] {
  const chars: HTMLElement[] = [];
  Array.from(words).forEach((wordEl) => {
    const word = wordEl as HTMLElement;
    const text = word.textContent || '';
    word.textContent = '';
    word.classList.add('word');
    text.split('').forEach((letter) => {
      if (letter === ' ') { word.appendChild(document.createTextNode(' ')); return; }
      const char = document.createElement('span');
      char.className = `char char--${letter.toUpperCase()}`;
      const inner = document.createElement('span');
      inner.className = 'char__inner';
      inner.dataset.letter = letter.toUpperCase();
      inner.textContent = letter;
      char.appendChild(inner);
      word.appendChild(char);
      chars.push(char);
    });
  });
  return chars;
}
