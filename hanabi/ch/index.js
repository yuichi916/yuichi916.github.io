// 物語の章の並び。章を足したら、ここに 1 行足す
import * as hoshi from './hoshi.js';
import * as toro from './toro.js';
import * as kage from './kage.js';
import * as yuki from './yuki.js';
import * as kitsune from './kitsune.js';
import * as hyakki from './hyakki.js';
import * as ie from './ie.js';
export const CHAPTERS = [hoshi, toro, kage, yuki, kitsune, hyakki, ie].map((mod) => ({ mod }));
