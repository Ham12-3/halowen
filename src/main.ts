import './style.css';
import { Game } from './game/Game';

const container = document.getElementById('app');
if (!container) throw new Error('Missing #app container');

const game = new Game(container);
game.start();

// Handy for poking at state from the browser console during development.
if (import.meta.env.DEV) Object.assign(window, { game });
