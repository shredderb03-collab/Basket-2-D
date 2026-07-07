/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum GameMode {
  PRACTICE = 'PRACTICE',
  PASS_AND_PLAY = 'PASS_AND_PLAY',
  VS_CPU = 'VS_CPU',
}

export interface AudioSettings {
  musicEnabled: boolean;
  sfxEnabled: boolean;
}

export interface PlayerStats {
  score: number;
  shotsTaken: number;
  shotsMade: number;
  streak: number;
  bestStreak: number;
}

export interface GameScoreState {
  player1: PlayerStats;
  player2: PlayerStats;
  currentTurn: 1 | 2;
  level: number;
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface PhysicsObject {
  pos: Vector2D;
  vel: Vector2D;
  radius: number;
  mass: number;
  restitution: number; // bounciness
  rotation: number;
  angularVelocity: number;
}

export interface HoopConfig {
  x: number; // backboard x
  y: number; // backboard top y
  rimX: number; // front rim x
  rimY: number; // rim y
  rimRadius: number; // visual rim thickness
  backboardWidth: number;
  backboardHeight: number;
  netHeight: number;
}

export interface Particle {
  pos: Vector2D;
  vel: Vector2D;
  color: string;
  size: number;
  alpha: number;
  decay: number;
  gravity: number;
}
