/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { GameMode, GameScoreState, Vector2D, PhysicsObject, HoopConfig, Particle } from '../types';
import { gameAudio } from '../lib/audio';

interface BasketballCanvasProps {
  mode: GameMode;
  scoreState: GameScoreState;
  setScoreState: React.Dispatch<React.SetStateAction<GameScoreState>>;
  audioSettings: { musicEnabled: boolean; sfxEnabled: boolean };
  hummanEnabled: boolean;
  ballRadius: number;
}

interface RagdollJoint {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  radius: number;
  label: string;
}

const initRagdoll = (bx: number, by: number): RagdollJoint[] => {
  return [
    { x: bx - 14, y: by + 12, prevX: bx - 14, prevY: by + 12, radius: 4, label: 'left_hand' },
    { x: bx + 14, y: by + 12, prevX: bx + 14, prevY: by + 12, radius: 4, label: 'right_hand' },
    { x: bx, y: by + 22, prevX: bx, prevY: by + 22, radius: 6, label: 'chest' },
    { x: bx, y: by + 8, prevX: bx, prevY: by + 8, radius: 8, label: 'head' },
    { x: bx, y: by + 40, prevX: bx, prevY: by + 40, radius: 5, label: 'pelvis' },
    { x: bx - 12, y: by + 60, prevX: bx - 12, prevY: by + 60, radius: 4, label: 'left_foot' },
    { x: bx + 12, y: by + 60, prevX: bx + 12, prevY: by + 60, radius: 4, label: 'right_foot' }
  ];
};

const initCheeringRagdoll = (sideX: number, floorY: number): RagdollJoint[] => {
  const by = floorY - 60; // head height
  return [
    { x: sideX - 8, y: floorY - 30, prevX: sideX - 8, prevY: floorY - 30, radius: 4, label: 'left_hand' },
    { x: sideX + 8, y: floorY - 30, prevX: sideX + 8, prevY: floorY - 30, radius: 4, label: 'right_hand' },
    { x: sideX, y: floorY - 35, prevX: sideX, prevY: floorY - 35, radius: 6, label: 'chest' },
    { x: sideX, y: floorY - 50, prevX: sideX, prevY: floorY - 50, radius: 8, label: 'head' },
    { x: sideX, y: floorY - 20, prevX: sideX, prevY: floorY - 20, radius: 5, label: 'pelvis' },
    { x: sideX - 6, y: floorY, prevX: sideX - 6, prevY: floorY, radius: 4, label: 'left_foot' },
    { x: sideX + 6, y: floorY, prevX: sideX + 6, prevY: floorY, radius: 4, label: 'right_foot' }
  ];
};

const HUMMAN_COLORS = [
  '#38bdf8', // glowing cyan (default)
  '#ec4899', // hot pink
  '#10b981', // emerald green
  '#f59e0b', // amber yellow
  '#8b5cf6', // purple
  '#ef4444', // bright red
  '#ffffff', // crisp white
];

const HUMMAN_PATTERNS = [
  'solid',        // solid color
  'striped',      // dashed lines
  'polka-dot',    // small dotted lines
  'matrix',       // code terminal dash arrays
  'glowing-aura', // heavy shadow blur glow
];

// Fixed design resolution for deterministic physics
const WIDTH = 800;
const HEIGHT = 500;
const BALL_START_X = 140;
const BALL_START_Y = 360;

export default function BasketballCanvas({
  mode,
  scoreState,
  setScoreState,
  audioSettings,
  hummanEnabled,
  ballRadius,
}: BasketballCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game state refs (needed inside the requestAnimationFrame loop to prevent stale React state closures)
  const stateRef = useRef({
    mode,
    scoreState,
    hummanEnabled,
    ragdoll: {
      joints: [] as RagdollJoint[],
    },
    hummanAttached: true,
    hummanReattachCooldown: 0,
    hummanColorIndex: 0,
    hummanPatternIndex: 0,
    cpuRagdoll: {
      joints: [] as RagdollJoint[],
    },
    cpuHummanAttached: false,
    cpuHummanReattachCooldown: 0,
    cpuPrecision: 1.0,
    ball: {
      pos: { x: BALL_START_X, y: BALL_START_Y },
      vel: { x: 0, y: 0 },
      radius: 18,
      mass: 1.0,
      restitution: 0.88, // 88% bounciness (more bouncy!)
      rotation: 0,
      angularVelocity: 0,
    } as PhysicsObject,
    hoop: {
      x: 680, // Backboard x
      y: 110, // Backboard top
      rimX: 615, // Front rim point x (hoop extends from 615 to 675)
      rimY: 185, // Hoop height
      rimRadius: 4,
      backboardWidth: 10,
      backboardHeight: 100,
      netHeight: 50,
    } as HoopConfig,
    
    // Wind force (unlocked at higher levels in PRACTICE mode)
    windForce: 0 as number,
    
    // Sling dragging state
    isDragging: false,
    dragStart: { x: BALL_START_X, y: BALL_START_Y } as Vector2D,
    dragCurrent: { x: BALL_START_X, y: BALL_START_Y } as Vector2D,
    
    // Physics / Shooting lifecycle
    ballState: 'launcher' as 'launcher' | 'drag' | 'flight' | 'resting' | 'resetting',
    hasScoredCurrentShot: false,
    isSwish: true, // starts true, gets falsed if ball hits rim or backboard
    shotTimer: 0, // auto reset ball if stuck
    
    // Particles and text effects
    particles: [] as Particle[],
    floatingTexts: [] as Array<{ pos: Vector2D; text: string; color: string; life: number; velocityY: number }>,
    
    // CPU state
    cpuCooldown: 0,
    cpuShootDelay: 0,
    cpuTargetVelocity: null as Vector2D | null,
    cpuDragProgress: 0, // for animating the CPU shot dragging
    
    // Net nodes for dynamic sway simulation
    netNodes: [] as Array<{ x: number; y: number; originalX: number; originalY: number; vx: number; vy: number }>,
    
    // Hoop movement velocity
    hoopDirectionY: 1,
    hoopDirectionX: 1,
  });

  // Keep stateRef in sync with incoming props
  useEffect(() => {
    stateRef.current.mode = mode;
  }, [mode]);

  useEffect(() => {
    stateRef.current.scoreState = scoreState;
  }, [scoreState]);

  useEffect(() => {
    stateRef.current.ball.radius = ballRadius;
  }, [ballRadius]);

  useEffect(() => {
    stateRef.current.hummanEnabled = hummanEnabled;
    const r = stateRef.current;
    if (hummanEnabled) {
      if (r.ragdoll.joints.length === 0) {
        if (r.scoreState.currentTurn === 1) {
          r.ragdoll.joints = initRagdoll(r.ball.pos.x, r.ball.pos.y);
          r.hummanAttached = true;
          r.cpuRagdoll.joints = initCheeringRagdoll(60, 440);
          r.cpuHummanAttached = false;
        } else {
          r.ragdoll.joints = initCheeringRagdoll(60, 440);
          r.hummanAttached = false;
          r.cpuRagdoll.joints = initRagdoll(r.ball.pos.x, r.ball.pos.y);
          r.cpuHummanAttached = true;
        }
      }
    } else {
      r.ragdoll.joints = [];
      r.cpuRagdoll.joints = [];
      r.hummanAttached = true;
      r.cpuHummanAttached = false;
    }
  }, [hummanEnabled]);

  // Handle Net Node Initialization
  useEffect(() => {
    const r = stateRef.current;
    // Create grid of net nodes (4 rows, 5 columns hanging from rimX to rimX+60)
    const nodes = [];
    const rimWidth = 60; // distance from rim tip to backboard
    const rimLeft = r.hoop.rimX;
    const rimY = r.hoop.rimY;
    
    for (let row = 0; row < 5; row++) {
      const rowY = rimY + (row * 10);
      const taper = row / 5; // net gets narrower at bottom
      const rowWidth = rimWidth * (1 - taper * 0.4);
      const rowLeft = rimLeft + (rimWidth * taper * 0.2);
      
      for (let col = 0; col < 5; col++) {
        const x = rowLeft + (rowWidth * (col / 4));
        nodes.push({
          x,
          y: rowY,
          originalX: x,
          originalY: rowY,
          vx: 0,
          vy: 0
        });
      }
    }
    r.netNodes = nodes;
  }, []);

  // Sync Audio Settings
  useEffect(() => {
    gameAudio.setSettings({
      musicEnabled: audioSettings.musicEnabled,
      sfxEnabled: audioSettings.sfxEnabled,
    });
  }, [audioSettings]);

  // Main Canvas Setup and Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId: number;

    const updatePhysics = () => {
      const r = stateRef.current;
      const b = r.ball;
      const h = r.hoop;

      const triggerWipeout = (text: string, color: string) => {
        const currentTurn = r.scoreState.currentTurn;
        if (currentTurn === 1) {
          r.hummanAttached = false;
          r.hummanReattachCooldown = 120;
        } else {
          r.cpuHummanAttached = false;
          r.cpuHummanReattachCooldown = 120;
        }
        r.floatingTexts.push({
          pos: { x: b.pos.x, y: b.pos.y - 25 },
          text: currentTurn === 1 ? text : `BOT ${text}`,
          color: currentTurn === 1 ? color : '#a855f7',
          life: 1.5,
          velocityY: -2.0
        });
        const joints = currentTurn === 1 ? r.ragdoll.joints : r.cpuRagdoll.joints;
        joints.forEach(j => {
          const dx = j.x - b.pos.x;
          const dy = j.y - b.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          j.x += (dx / dist) * 15;
          j.y += (dy / dist) * 15;
          j.prevX = j.x - (b.vel.x * 1.1 + (Math.random() - 0.5) * 4);
          j.prevY = j.y - (b.vel.y * 1.1 + (Math.random() - 0.5) * 4);
        });
        gameAudio.playRimSound();
      };

      const updateSingleRagdoll = (
        joints: RagdollJoint[],
        playerIndex: 1 | 2
      ) => {
        const isAttached = playerIndex === 1 ? r.hummanAttached : r.cpuHummanAttached;
        const isActive = r.scoreState.currentTurn === playerIndex;
        
        // 1. Verlet Integration
        joints.forEach(j => {
          const vx = (j.x - j.prevX) * 0.96;
          const vy = (j.y - j.prevY) * 0.96;
          j.prevX = j.x;
          j.prevY = j.y;
          j.x += vx + (r.windForce * 0.5);
          j.y += vy + 0.32;
        });

        // 2. Ball Collisions & Knockout (only if not attached to the ball)
        if (!isAttached) {
          let wasHitByBall = false;
          let hitJointIndex = -1;
          const reattachCooldown = playerIndex === 1 ? r.hummanReattachCooldown : r.cpuHummanReattachCooldown;

          for (let i = 0; i < joints.length; i++) {
            const j = joints[i];
            const dx = j.x - b.pos.x;
            const dy = j.y - b.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = b.radius + j.radius - 1;

            if (dist < minDist) {
              const ballSpeed = Math.sqrt(b.vel.x * b.vel.x + b.vel.y * b.vel.y);
              if (ballSpeed > 2.2) {
                if (reattachCooldown < 90) {
                  wasHitByBall = true;
                  hitJointIndex = i;
                  break;
                }
              } else {
                // Stationary resolve overlap
                const pushDirX = dx / (dist || 1);
                const pushDirY = dy / (dist || 1);
                const overlap = minDist - dist;
                j.x += pushDirX * overlap * 0.4;
                j.y += pushDirY * overlap * 0.4;
                b.pos.x -= pushDirX * overlap * 0.6;
                b.pos.y -= pushDirY * overlap * 0.6;
                b.vel.x = b.vel.x * 0.8 - pushDirX * 0.15;
                b.vel.y = b.vel.y * 0.8 - pushDirY * 0.15;
              }
            }
          }

          if (wasHitByBall) {
            const ballSpeed = Math.sqrt(b.vel.x * b.vel.x + b.vel.y * b.vel.y);
            const newCooldown = 120; // 2 seconds
            if (playerIndex === 1) {
              r.hummanReattachCooldown = newCooldown;
            } else {
              r.cpuHummanReattachCooldown = newCooldown;
            }

            const pushScale = Math.max(1.8, ballSpeed * 0.65);
            const pushX = b.vel.x * pushScale + (b.vel.x > 0 ? 3.5 : -3.5);
            const pushY = Math.min(-5.0, b.vel.y * pushScale - 4.5);

            joints.forEach(j => {
              const flailX = (Math.random() - 0.5) * 5;
              const flailY = (Math.random() - 0.5) * 5;
              j.x += pushX + flailX;
              j.y += pushY + flailY;
              j.prevX = j.x - (pushX + flailX * 1.6);
              j.prevY = j.y - (pushY + flailY * 1.6);
            });

            // Text feedback
            const nameLabel = playerIndex === 1 ? 'PLAYER' : (r.mode === GameMode.VS_CPU ? 'BOT' : 'PLAYER 2');
            let knockoutText = `${nameLabel} KNOCKED OUT!`;
            if (hitJointIndex === 3) {
              knockoutText = ballSpeed > 8.0 ? `CATASTROPHIC ${nameLabel} HEADSHOT!` : `${nameLabel} HEADSHOT! KO!`;
            } else if (ballSpeed > 8.0) {
              knockoutText = `${nameLabel} BLASTED KO!`;
            } else if (ballSpeed > 5.0) {
              knockoutText = `${nameLabel} CRITICAL HIT! KO!`;
            }

            r.floatingTexts.push({
              pos: { x: b.pos.x, y: b.pos.y - 35 },
              text: knockoutText,
              color: playerIndex === 1 ? '#ef4444' : '#fb923c',
              life: 1.8,
              velocityY: -2.2
            });

            // Spark particles
            const particleCount = Math.floor(ballSpeed * 3) + 12;
            const pColor = playerIndex === 1 ? '#ef4444' : '#f97316';
            for (let k = 0; k < particleCount; k++) {
              r.particles.push({
                pos: { x: b.pos.x + (Math.random() - 0.5) * 15, y: b.pos.y + (Math.random() - 0.5) * 15 },
                vel: { x: (Math.random() - 0.5) * 10 + (pushX * 0.2), y: -Math.random() * 6 - 2 },
                color: pColor,
                size: Math.random() * 4 + 2,
                alpha: 1.0,
                decay: 0.02,
                gravity: 0.15
              });
            }

            b.vel.x = -b.vel.x * 0.35;
            b.vel.y = -b.vel.y * 0.35;
            gameAudio.playBounceSound(0.95);
          }
        }

        // Decrement cooldowns
        if (playerIndex === 1) {
          if (r.hummanReattachCooldown > 0) r.hummanReattachCooldown--;
        } else {
          if (r.cpuHummanReattachCooldown > 0) r.cpuHummanReattachCooldown--;
        }

        const currentCooldown = playerIndex === 1 ? r.hummanReattachCooldown : r.cpuHummanReattachCooldown;

        // 3. Crawler Behavior
        if (!isAttached) {
          if (isActive) {
            // ACTIVE player crawls to the ball!
            const chest = joints[2];
            const dx = b.pos.x - chest.x;
            const dy = b.pos.y - chest.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            // Reattach if reached
            if (currentCooldown === 0 && dist <= b.radius + 15) {
              if (playerIndex === 1) {
                r.hummanAttached = true;
              } else {
                r.cpuHummanAttached = true;
              }
              // Sparkles on connection!
              const connText = playerIndex === 1 ? 'READY TO SHOOT' : 'BOT READY';
              r.floatingTexts.push({
                pos: { x: joints[3].x, y: joints[3].y - 25 },
                text: connText,
                color: playerIndex === 1 ? '#10b981' : '#a855f7',
                life: 1.2,
                velocityY: -1.8
              });
              const sparkColor = playerIndex === 1 ? '#10b981' : '#a855f7';
              for (let i = 0; i < 15; i++) {
                r.particles.push({
                  pos: { x: joints[2].x, y: joints[2].y },
                  vel: { x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 6 },
                  color: sparkColor,
                  size: Math.random() * 3 + 2,
                  alpha: 1.0,
                  decay: 0.03,
                  gravity: 0.1
                });
              }
            } else if (currentCooldown === 0) {
              // Crawl movement towards the ball
              const dirX = dx / dist;
              const dirY = dy / dist;
              const crawlCycle = Date.now() * 0.0022;
              const crawlDir = dx > 0 ? 1 : -1;
              const floorY = 440;

              const chestTargetY = floorY - 12;
              const pelvisTargetY = floorY - 9;
              const headTargetY = floorY - 20;

              joints[2].y = joints[2].y * 0.92 + chestTargetY * 0.08;
              joints[4].y = joints[4].y * 0.92 + pelvisTargetY * 0.08;
              joints[3].y = joints[3].y * 0.92 + headTargetY * 0.08;

              joints[3].x = joints[2].x + crawlDir * 4;
              joints[2].x += dirX * 0.15;
              joints[4].x += dirX * 0.13;

              const leftHandWeight = Math.sin(crawlCycle);
              if (leftHandWeight > 0) {
                const targetX = joints[2].x + crawlDir * 16 + leftHandWeight * 8;
                const targetY = floorY - 3;
                joints[0].x = joints[0].x * 0.75 + targetX * 0.25;
                joints[0].y = joints[0].y * 0.75 + targetY * 0.25;
              } else {
                const targetX = joints[2].x - crawlDir * 6 + leftHandWeight * 3;
                const targetY = floorY - 6;
                joints[0].x = joints[0].x * 0.82 + targetX * 0.18;
                joints[0].y = joints[0].y * 0.82 + targetY * 0.18;
              }

              if (leftHandWeight <= 0) {
                const targetX = joints[2].x + crawlDir * 16 - leftHandWeight * 8;
                const targetY = floorY - 3;
                joints[1].x = joints[1].x * 0.75 + targetX * 0.25;
                joints[1].y = joints[1].y * 0.75 + targetY * 0.25;
              } else {
                const targetX = joints[2].x - crawlDir * 6 - leftHandWeight * 3;
                const targetY = floorY - 6;
                joints[1].x = joints[1].x * 0.82 + targetX * 0.18;
                joints[1].y = joints[1].y * 0.82 + targetY * 0.18;
              }

              const leftFootPush = Math.cos(crawlCycle);
              const targetFoot5X = joints[4].x - crawlDir * 14 + leftFootPush * 4;
              const targetFoot5Y = floorY - 3;
              joints[5].x = joints[5].x * 0.88 + targetFoot5X * 0.12;
              joints[5].y = joints[5].y * 0.88 + targetFoot5Y * 0.12;

              const targetFoot6X = joints[4].x - crawlDir * 14 - leftFootPush * 4;
              const targetFoot6Y = floorY - 3;
              joints[6].x = joints[6].x * 0.88 + targetFoot6X * 0.12;
              joints[6].y = joints[6].y * 0.88 + targetFoot6Y * 0.12;

              if (Math.random() < 0.2) {
                const sparkColor = playerIndex === 1 ? HUMMAN_COLORS[r.hummanColorIndex || 0] : '#a855f7';
                r.particles.push({
                  pos: { x: joints[crawlDir > 0 ? 0 : 1].x, y: floorY - 1 },
                  vel: { x: -crawlDir * (Math.random() * 1.5 + 0.5), y: -Math.random() * 1 },
                  color: sparkColor,
                  size: Math.random() * 2 + 1,
                  alpha: 0.7,
                  decay: 0.04,
                  gravity: 0.05
                });
              }

              // Crawling floating text
              if (Math.random() < 0.007) {
                const textOptions = playerIndex === 1 ? [
                  'Must... reach... ball!',
                  'Almost... got it...',
                  'Left, right, crawl...',
                  'Crawling flat...',
                  'Oof, my legs...',
                  'Reach with left...',
                  'Reach with right...',
                  'Gotta grab the ball!'
                ] : [
                  '🤖 Initiating crawl protocols...',
                  '🤖 Target acquisition ongoing...',
                  '🤖 Locomotion calibrated...',
                  '🤖 Manual recovery engaged...',
                  '🤖 Repairing balance arrays...',
                  '🤖 Moving to ball coordinates...'
                ];
                r.floatingTexts.push({
                  pos: { x: joints[3].x, y: joints[3].y - 25 },
                  text: textOptions[Math.floor(Math.random() * textOptions.length)],
                  color: playerIndex === 1 ? HUMMAN_COLORS[r.hummanColorIndex || 0] : '#fb923c',
                  life: 1.2,
                  velocityY: -1.0
                });
              }
            }
          } else {
            // INACTIVE player stands and cheers at the sidelines!
            const sideX = 60;
            const floorY = 440;
            
            joints[4].x = joints[4].x * 0.94 + sideX * 0.06;
            joints[2].x = joints[2].x * 0.94 + sideX * 0.06;
            joints[3].x = joints[3].x * 0.94 + sideX * 0.06;

            joints[4].y = joints[4].y * 0.94 + (floorY - 20) * 0.06;
            joints[2].y = joints[2].y * 0.94 + (floorY - 35) * 0.06;
            joints[3].y = joints[3].y * 0.94 + (floorY - 50) * 0.06;

            joints[5].x = joints[5].x * 0.90 + (sideX - 6) * 0.10;
            joints[5].y = joints[5].y * 0.90 + (floorY - joints[5].radius) * 0.10;
            joints[6].x = joints[6].x * 0.90 + (sideX + 6) * 0.10;
            joints[6].y = joints[6].y * 0.90 + (floorY - joints[6].radius) * 0.10;

            if (r.ballState === 'flight') {
              const waveCycle = Date.now() * 0.015;
              const handY = floorY - 55 + Math.sin(waveCycle) * 6;
              joints[0].x = joints[0].x * 0.85 + (sideX - 10 + Math.cos(waveCycle) * 3) * 0.15;
              joints[0].y = joints[0].y * 0.85 + handY * 0.15;

              joints[1].x = joints[1].x * 0.85 + (sideX + 10 - Math.cos(waveCycle) * 3) * 0.15;
              joints[1].y = joints[1].y * 0.85 + handY * 0.15;
            } else {
              joints[0].x = joints[0].x * 0.92 + (sideX - 8) * 0.08;
              joints[0].y = joints[0].y * 0.92 + (floorY - 25) * 0.08;

              joints[1].x = joints[1].x * 0.92 + (sideX + 8) * 0.08;
              joints[1].y = joints[1].y * 0.92 + (floorY - 25) * 0.08;
            }
          }
        }

        // 4. Connection Constraints (8 iterations)
        const constraints = [
          { a: 0, b: 2, len: 18 },
          { a: 1, b: 2, len: 18 },
          { a: 3, b: 2, len: 14 },
          { a: 4, b: 2, len: 18 },
          { a: 5, b: 4, len: 22 },
          { a: 6, b: 4, len: 22 },
        ];

        for (let iter = 0; iter < 8; iter++) {
          if (isAttached) {
            const angleOffsetL = -Math.PI / 1.5 + b.rotation;
            const angleOffsetR = Math.PI / 1.5 + b.rotation;
            const targetHandLX = b.pos.x + Math.cos(angleOffsetL) * b.radius;
            const targetHandLY = b.pos.y + Math.sin(angleOffsetL) * b.radius;
            const targetHandRX = b.pos.x + Math.cos(angleOffsetR) * b.radius;
            const targetHandRY = b.pos.y + Math.sin(angleOffsetR) * b.radius;

            joints[0].x = targetHandLX;
            joints[0].y = targetHandLY;
            joints[1].x = targetHandRX;
            joints[1].y = targetHandRY;
          }

          constraints.forEach(c => {
            const jA = joints[c.a];
            const jB = joints[c.b];
            const dx = jB.x - jA.x;
            const dy = jB.y - jA.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const diff = c.len - dist;
            const percent = (diff / dist) * 0.5;
            const ox = dx * percent;
            const oy = dy * percent;

            if (isAttached && (c.a === 0 || c.a === 1)) {
              jB.x += ox * 2.0;
              jB.y += oy * 2.0;
            } else {
              jA.x -= ox;
              jA.y -= oy;
              jB.x += ox;
              jB.y += oy;
            }
          });

          // Ball collision check for other joints to prevent collapsing
          const startIdx = isAttached ? 2 : 0;
          for (let i = startIdx; i < joints.length; i++) {
            const j = joints[i];
            const dx = j.x - b.pos.x;
            const dy = j.y - b.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const minDist = b.radius + j.radius - 2;
            if (dist < minDist) {
              const push = minDist - dist;
              j.x += (dx / dist) * push;
              j.y += (dy / dist) * push;
            }
          }
        }

        // 5. Floor & wall bounds
        joints.forEach(j => {
          const floorY = 440;
          if (j.y + j.radius > floorY) {
            j.y = floorY - j.radius;
            j.x = j.x * 0.95 + j.prevX * 0.05;
          }
          if (j.x - j.radius < 0) j.x = j.radius;
          if (j.x + j.radius > WIDTH) j.x = WIDTH - j.radius;
        });
      };

      // Ensure audio context is running when game is active
      gameAudio.ensureInitialized();

      // --- 1. HOOP MOVEMENT (Based on level) ---
      if (r.mode === GameMode.PRACTICE) {
        const lvl = r.scoreState.level;
        // Level 2+ moves hoop up/down
        if (lvl >= 2) {
          const speed = Math.min(1.5, 0.4 + lvl * 0.2);
          h.rimY += r.hoopDirectionY * speed;
          h.y += r.hoopDirectionY * speed;
          
          if (h.rimY > 250) r.hoopDirectionY = -1;
          if (h.rimY < 120) r.hoopDirectionY = 1;
        }
        // Level 3+ also moves hoop left/right slightly
        if (lvl >= 3) {
          const speed = Math.min(1.2, 0.3 + lvl * 0.15);
          h.x += r.hoopDirectionX * speed;
          h.rimX += r.hoopDirectionX * speed;
          
          if (h.rimX < 540) r.hoopDirectionX = 1;
          if (h.rimX > 680) r.hoopDirectionX = -1;
        }
        // Level 4+ adds active lateral wind
        if (lvl >= 4 && Math.abs(r.windForce) < 0.01) {
          // set wind direction
          r.windForce = (Math.random() * 0.14 - 0.07) * (lvl * 0.3);
        }
      } else {
        // Reset hoop positions for multiplayer or vs CPU to standard starting coordinates
        h.x = 680;
        h.rimX = 615;
        h.rimY = 185;
        h.y = 110;
        r.windForce = 0;
      }

      // --- 2. BALL FLIGHT PHYSICS ---
      if (r.ballState === 'flight') {
        r.shotTimer += 16.67; // Add milliseconds roughly

        // Apply Gravity
        b.vel.y += 0.36; // Gravity constant

        // Apply Wind Force
        b.vel.x += r.windForce;

        // Apply Air Friction
        b.vel.x *= 0.993;
        b.vel.y *= 0.993;

        // Update positions
        b.pos.x += b.vel.x;
        b.pos.y += b.vel.y;

        // Apply Rotation spin based on velocity
        b.rotation += b.angularVelocity;
        b.angularVelocity *= 0.98; // rotational friction

        // Trail particles
        if (Math.abs(b.vel.x) > 1 || Math.abs(b.vel.y) > 1) {
          if (Math.random() < 0.4) {
            r.particles.push({
              pos: { x: b.pos.x, y: b.pos.y },
              vel: { x: (Math.random() - 0.5) * 1, y: (Math.random() - 0.5) * 1 },
              color: `rgba(${230 + Math.random() * 25}, ${110 + Math.random() * 60}, 20, 0.65)`,
              size: Math.random() * 4 + 3,
              alpha: 0.8,
              decay: 0.03,
              gravity: -0.02
            });
          }
        }

        // --- COLLISIONS ---

        // A. FLOOR COLLISION
        const floorY = 440;
        if (b.pos.y + b.radius >= floorY) {
          const hitSpeed = Math.sqrt(b.vel.x * b.vel.x + b.vel.y * b.vel.y);
          b.pos.y = floorY - b.radius;
          b.vel.y = -Math.abs(b.vel.y) * b.restitution;
          
          const activeAttached = r.scoreState.currentTurn === 1 ? r.hummanAttached : r.cpuHummanAttached;
          if (r.hummanEnabled && activeAttached && hitSpeed > 7.5) {
            triggerWipeout('WIPEOUT! OOF!', '#f43f5e');
          }

          // Friction rolls the ball
          const slideSpeed = b.vel.x;
          b.vel.x *= 0.82; // floor friction
          b.angularVelocity = slideSpeed * 0.06;

          // Sound
          if (Math.abs(b.vel.y) > 0.6) {
            gameAudio.playBounceSound(Math.min(1, Math.abs(b.vel.y) / 6));
            r.floatingTexts.push({
              pos: { x: b.pos.x, y: b.pos.y - 10 },
              text: 'BOUNCE',
              color: '#94a3b8',
              life: 0.6,
              velocityY: -1.2
            });
          }
        }

        // B. WALL/BOUNDARY COLLISION
        if (b.pos.x - b.radius < 0) {
          const hitSpeed = Math.abs(b.vel.x);
          b.pos.x = b.radius;
          b.vel.x = Math.abs(b.vel.x) * b.restitution;
          
          const activeAttached = r.scoreState.currentTurn === 1 ? r.hummanAttached : r.cpuHummanAttached;
          if (r.hummanEnabled && activeAttached && hitSpeed > 7.5) {
            triggerWipeout('WALL WIPEOUT!', '#ef4444');
          }

          if (Math.abs(b.vel.x) > 0.5) gameAudio.playBounceSound(Math.abs(b.vel.x) / 8);
        }
        if (b.pos.x + b.radius > WIDTH) {
          const hitSpeed = Math.abs(b.vel.x);
          b.pos.x = WIDTH - b.radius;
          b.vel.x = -Math.abs(b.vel.x) * b.restitution;
          
          const activeAttached = r.scoreState.currentTurn === 1 ? r.hummanAttached : r.cpuHummanAttached;
          if (r.hummanEnabled && activeAttached && hitSpeed > 7.5) {
            triggerWipeout('WALL WIPEOUT!', '#ef4444');
          }

          if (Math.abs(b.vel.x) > 0.5) gameAudio.playBounceSound(Math.abs(b.vel.x) / 8);
        }

        // C. BACKBOARD COLLISION
        // Backboard is a thick vertical box at x: h.x, y: h.y to h.y + h.backboardHeight
        const bbX = h.x;
        const bbLeft = bbX;
        const bbRight = bbX + h.backboardWidth;
        const bbTop = h.y;
        const bbBottom = h.y + h.backboardHeight;

        // Broad phase box boundary check
        if (
          b.pos.x + b.radius >= bbLeft &&
          b.pos.x - b.radius <= bbRight &&
          b.pos.y + b.radius >= bbTop &&
          b.pos.y - b.radius <= bbBottom
        ) {
          const hitSpeed = Math.sqrt(b.vel.x * b.vel.x + b.vel.y * b.vel.y);
          // Resolve collision based on closest side
          const distLeft = Math.abs((b.pos.x + b.radius) - bbLeft);
          const distRight = Math.abs((b.pos.x - b.radius) - bbRight);
          const distTop = Math.abs((b.pos.y + b.radius) - bbTop);
          const distBottom = Math.abs((b.pos.y - b.radius) - bbBottom);

          const minDist = Math.min(distLeft, distRight, distTop, distBottom);

          r.isSwish = false; // hit backboard

          if (minDist === distLeft) {
            b.pos.x = bbLeft - b.radius;
            b.vel.x = -Math.abs(b.vel.x) * b.restitution;
          } else if (minDist === distRight) {
            b.pos.x = bbRight + b.radius;
            b.vel.x = Math.abs(b.vel.x) * b.restitution;
          } else if (minDist === distTop) {
            b.pos.y = bbTop - b.radius;
            b.vel.y = -Math.abs(b.vel.y) * b.restitution;
          } else {
            b.pos.y = bbBottom + b.radius;
            b.vel.y = Math.abs(b.vel.y) * b.restitution;
          }

          const activeAttached = r.scoreState.currentTurn === 1 ? r.hummanAttached : r.cpuHummanAttached;
          if (r.hummanEnabled && activeAttached && hitSpeed > 7.5) {
            triggerWipeout('BOARD WIPEOUT!', '#f43f5e');
          }

          // Backboard sound
          if (Math.abs(b.vel.x) > 0.5 || Math.abs(b.vel.y) > 0.5) {
            gameAudio.playBounceSound(0.5);
            r.angularVelocity += b.vel.y * 0.05; // give spin on board hit
          }
        }

        // D. RIM COLLISION (Circle-Circle collision on left rim tip and right rim base near board)
        const checkRimCollision = (rimX: number, rimY: number) => {
          const dx = b.pos.x - rimX;
          const dy = b.pos.y - rimY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDist = b.radius + h.rimRadius;

          if (distance < minDist) {
            r.isSwish = false; // Hit the iron, no swish possible

            // Angle of collision
            const angle = Math.atan2(dy, dx);
            
            // Push ball out of collision
            b.pos.x = rimX + Math.cos(angle) * minDist;
            b.pos.y = rimY + Math.sin(angle) * minDist;

            // Reflect velocity with rim restitution
            const speed = Math.sqrt(b.vel.x * b.vel.x + b.vel.y * b.vel.y);
            const normalX = Math.cos(angle);
            const normalY = Math.sin(angle);
            
            // Dot product of velocity and normal
            const dot = b.vel.x * normalX + b.vel.y * normalY;

            b.vel.x = (b.vel.x - 2 * dot * normalX) * b.restitution;
            b.vel.y = (b.vel.y - 2 * dot * normalY) * b.restitution;

            const activeAttached = r.scoreState.currentTurn === 1 ? r.hummanAttached : r.cpuHummanAttached;
            if (r.hummanEnabled && activeAttached && speed > 7.5) {
              triggerWipeout('RIM CRASH!', '#f43f5e');
            }

            // Give the ball random deflection spin on rim contact
            b.angularVelocity = (Math.random() - 0.5) * 0.3 + (b.vel.x * 0.05);

            // Play rim sound
            if (speed > 0.4) {
              gameAudio.playRimSound();
              r.floatingTexts.push({
                pos: { x: rimX, y: rimY - 15 },
                text: 'CLANG!',
                color: '#f97316',
                life: 0.5,
                velocityY: -1.5
              });
            }
          }
        };

        // Check front edge of rim (the tip furthest from board)
        checkRimCollision(h.rimX, h.rimY);
        // Check back edge of rim (near backboard attachment)
        checkRimCollision(h.rimX + 60, h.rimY);

        // E. BASKET / SCORING TRIGGER
        // To score, the ball's center must cross the hoop segment [h.rimX, h.rimX + 60] vertically downwards.
        // Hoop plane is at y = h.rimY (185)
        const previousY = b.pos.y - b.vel.y;
        const currentY = b.pos.y;
        const hoopY = h.rimY;

        if (
          !r.hasScoredCurrentShot &&
          previousY <= hoopY && 
          currentY >= hoopY &&
          b.pos.x >= h.rimX && 
          b.pos.x <= h.rimX + 60
        ) {
          // SWISH / MAKE TRIGGER
          r.hasScoredCurrentShot = true;
          
          // Play sound
          if (r.isSwish) {
            gameAudio.playSwishSound();
            gameAudio.playCheerSound();
          } else {
            gameAudio.playSwishSound(); // regular score sound
            if (Math.random() < 0.6) gameAudio.playCheerSound();
          }

          // Score floating text and confetti particles
          const scoreText = r.isSwish ? 'SWISH! x2' : '+1 SCORE';
          const textColor = r.isSwish ? '#fbbf24' : '#f97316';
          
          r.floatingTexts.push({
            pos: { x: h.rimX + 30, y: h.rimY - 25 },
            text: scoreText,
            color: textColor,
            life: 1.2,
            velocityY: -1.8
          });

          // Confetti particles burst
          for (let i = 0; i < 40; i++) {
            r.particles.push({
              pos: { x: h.rimX + 30 + (Math.random() - 0.5) * 20, y: h.rimY + 10 },
              vel: { x: (Math.random() - 0.5) * 8, y: -Math.random() * 5 - 2 },
              color: `hsl(${Math.random() * 360}, 95%, 60%)`,
              size: Math.random() * 5 + 3,
              alpha: 1.0,
              decay: 0.015,
              gravity: 0.15
            });
          }

          // Update game score state!
          setScoreState((prev) => {
            const next = { ...prev };
            
            if (r.mode === GameMode.PRACTICE) {
              const points = r.isSwish ? 2 : 1;
              next.player1.score += points;
              next.player1.shotsMade += 1;
              next.player1.streak += 1;
              if (next.player1.streak > next.player1.bestStreak) {
                next.player1.bestStreak = next.player1.streak;
              }
              // Level Up logic: every 3 baskets made, advance a level!
              const newLevel = Math.floor(next.player1.shotsMade / 3) + 1;
              if (newLevel > next.level) {
                next.level = newLevel;
                // Play level up chime
                setTimeout(() => gameAudio.playChimeSound(), 400);
                r.floatingTexts.push({
                  pos: { x: WIDTH / 2, y: HEIGHT / 2 - 40 },
                  text: `LEVEL ${newLevel} UNLOCKED!`,
                  color: '#10b981',
                  life: 2.0,
                  velocityY: -1.0
                });
                // dynamic hoop resizing or moving takes effect in next frames
              }
            } else if (r.mode === GameMode.PASS_AND_PLAY) {
              const points = r.isSwish ? 2 : 1;
              if (prev.currentTurn === 1) {
                next.player1.score += points;
                next.player1.shotsMade += 1;
              } else {
                next.player2.score += points;
                next.player2.shotsMade += 1;
              }
            } else if (r.mode === GameMode.VS_CPU) {
              const points = r.isSwish ? 2 : 1;
              if (prev.currentTurn === 1) {
                next.player1.score += points;
                next.player1.shotsMade += 1;
              } else {
                next.player2.score += points;
                next.player2.shotsMade += 1;
              }
            }

            return next;
          });
        }

        // --- RESET CONDITIONS ---
        // Trigger a reset if the ball rolls off the screen, stops moving on the floor, or is stuck in the air.
        const isOffScreen = b.pos.y > HEIGHT + 40 || b.pos.x < -30 || b.pos.x > WIDTH + 30;
        const isNearlyStill = Math.abs(b.vel.y) < 0.1 && Math.abs(b.vel.x) < 0.1 && Math.abs(b.pos.y - (440 - b.radius)) < 1.0;

        let shouldReset = false;
        if (r.hummanEnabled && !r.hummanAttached && r.scoreState.currentTurn === 1) {
          // In human mode, do not reset if unattached and on-screen: let ball stop on court so player crawls back
          if (isNearlyStill) {
            b.vel.x = 0;
            b.vel.y = 0;
            r.ballState = 'launcher'; // make it ready so they can grab and shoot once attached
          }
          shouldReset = isOffScreen; // only reset if it rolls off the stage
        } else {
          const isTimeLimitExceeded = r.shotTimer > 4500; // 4.5 seconds safety trigger
          shouldReset = isOffScreen || isNearlyStill || isTimeLimitExceeded;
        }

        if (shouldReset) {
          r.ballState = 'resetting';
          
          // If we are practicing and missed this turn: reset streak
          if (r.mode === GameMode.PRACTICE && !r.hasScoredCurrentShot) {
            setScoreState((prev) => {
              const next = { ...prev };
              if (next.player1.streak > 0) {
                r.floatingTexts.push({
                  pos: { x: b.pos.x < 0 || b.pos.x > WIDTH ? WIDTH / 2 : b.pos.x, y: 150 },
                  text: `STREAK BROKEN`,
                  color: '#ef4444',
                  life: 1.0,
                  velocityY: -1.0
                });
              }
              next.player1.streak = 0;
              return next;
            });
          }

          // Delay for smooth transition
          setTimeout(() => {
            // CPU precision adjustment and emote text before turn shifts
            if (r.mode === GameMode.VS_CPU && r.scoreState.currentTurn === 2) {
              if (r.hasScoredCurrentShot) {
                r.cpuPrecision = 1.35; // lock in high accuracy!
                const hitTexts = ["🤖 TARGET LOCKED", "🤖 SPLASH", "🤖 CALCULATION SUCCESS", "🤖 BOOM! SWISH!"];
                r.floatingTexts.push({
                  pos: { x: b.pos.x < 0 || b.pos.x > WIDTH ? WIDTH / 2 : b.pos.x, y: 150 },
                  text: hitTexts[Math.floor(Math.random() * hitTexts.length)],
                  color: '#10b981',
                  life: 1.5,
                  velocityY: -1.2
                });
              } else {
                r.cpuPrecision = Math.min(3.0, (r.cpuPrecision || 1.0) + 0.35); // calibrate error smaller
                const missTexts = ["🤖 Trajectory error detected", "🤖 Recalibrating wind factor", "🤖 Targeting algorithm refined", "🤖 Upgrading optical sensors"];
                r.floatingTexts.push({
                  pos: { x: b.pos.x < 0 || b.pos.x > WIDTH ? WIDTH / 2 : b.pos.x, y: 150 },
                  text: missTexts[Math.floor(Math.random() * missTexts.length)],
                  color: '#f97316',
                  life: 1.5,
                  velocityY: -1.2
                });
              }
            }

            // Update turn if multiplayer or vs cpu
            setScoreState((prev) => {
              const next = { ...prev };
              
              if (r.mode === GameMode.PASS_AND_PLAY) {
                next.currentTurn = prev.currentTurn === 1 ? 2 : 1;
              } else if (r.mode === GameMode.VS_CPU) {
                next.currentTurn = prev.currentTurn === 1 ? 2 : 1;
                
                // CPU Trigger
                if (next.currentTurn === 2) {
                  r.cpuCooldown = 90; // Wait 1.5 seconds to start aiming
                  r.cpuDragProgress = 0;
                }
              }

              return next;
            });

            // Re-spawn Ball on launcher stand
            b.pos = { x: BALL_START_X, y: BALL_START_Y };
            b.vel = { x: 0, y: 0 };
            b.rotation = 0;
            b.angularVelocity = 0;
            r.hasScoredCurrentShot = false;
            r.isSwish = true;
            r.shotTimer = 0;
            r.ballState = 'launcher';

            if (r.hummanEnabled) {
              let nextTurn: 1 | 2 = 1;
              if (r.mode === GameMode.PASS_AND_PLAY || r.mode === GameMode.VS_CPU) {
                nextTurn = r.scoreState.currentTurn === 1 ? 2 : 1;
              }
              
              if (nextTurn === 1) {
                r.ragdoll.joints = initRagdoll(BALL_START_X, BALL_START_Y);
                r.hummanAttached = true;
                r.cpuRagdoll.joints = initCheeringRagdoll(60, 440);
                r.cpuHummanAttached = false;
              } else {
                r.ragdoll.joints = initCheeringRagdoll(60, 440);
                r.hummanAttached = false;
                r.cpuRagdoll.joints = initRagdoll(BALL_START_X, BALL_START_Y);
                r.cpuHummanAttached = true;
              }
            }
          }, 800);
        }
      }

      // --- 3. DYNAMIC NET SIMULATION ---
      // Net hangs down from h.rimX to h.rimX + 60.
      // Net nodes interact with the ball position!
      const netNodes = r.netNodes;
      if (netNodes.length > 0) {
        const rimLeft = h.rimX;
        const rimWidth = 60;
        const rimY = h.rimY;

        // Reset and update anchor nodes (row 0 is attached directly to the rim)
        for (let col = 0; col < 5; col++) {
          const nodeIdx = col;
          const targetX = rimLeft + (rimWidth * (col / 4));
          netNodes[nodeIdx].x = targetX;
          netNodes[nodeIdx].y = rimY;
          netNodes[nodeIdx].vx = 0;
          netNodes[nodeIdx].vy = 0;
        }

        // Simulating subsequent rows (rows 1 to 4)
        for (let row = 1; row < 5; row++) {
          const taper = row / 5;
          const rowWidth = rimWidth * (1 - taper * 0.4);
          const rowLeft = rimLeft + (rimWidth * taper * 0.2);

          for (let col = 0; col < 5; col++) {
            const idx = row * 5 + col;
            const node = netNodes[idx];
            
            // Base anchor spot (original position)
            const baseX = rowLeft + (rowWidth * (col / 4));
            const baseY = rimY + (row * 10);
            
            // Gravity on net threads
            node.vy += 0.22;

            // Spring force back to original resting coordinates
            const dxBase = baseX - node.x;
            const dyBase = baseY - node.y;
            node.vx += dxBase * 0.08;
            node.vy += dyBase * 0.08;

            // Spring connections to neighboring nodes (structural mesh)
            const neighbors = [];
            if (col > 0) neighbors.push(idx - 1); // left neighbor
            if (col < 4) neighbors.push(idx + 1); // right neighbor
            neighbors.push(idx - 5); // top neighbor

            neighbors.forEach(nIdx => {
              const n = netNodes[nIdx];
              const ndx = n.x - node.x;
              const ndy = n.y - node.y;
              const dist = Math.sqrt(ndx * ndx + ndy * ndy);
              const restDist = 10;
              const force = (dist - restDist) * 0.04;
              node.vx += (ndx / dist) * force;
              node.vy += (ndy / dist) * force;
            });

            // Ball interaction! Push net nodes outwards or downwards if the ball hits them
            const bdx = node.x - b.pos.x;
            const bdy = node.y - b.pos.y;
            const bDist = Math.sqrt(bdx * bdx + bdy * bdy);
            
            // Interaction range
            if (bDist < b.radius + 1) {
              const pushForce = (b.radius + 4 - bDist) * 0.55;
              const pushX = (bdx / bDist) * pushForce;
              const pushY = (bdy / bDist) * pushForce;
              
              node.x += pushX;
              node.y += pushY + Math.abs(b.vel.y) * 0.15; // move downwards with ball velocity
              node.vx += b.vel.x * 0.15;
              node.vy += b.vel.y * 0.12;
            }

            // Air friction
            node.vx *= 0.88;
            node.vy *= 0.88;

            // Update node position
            node.x += node.vx;
            node.y += node.vy;
          }
        }
      }

      // --- 3.5. DYNAMIC HUMMAN RAGDOLL PHYSICS ---
      if (r.hummanEnabled) {
        if (r.ragdoll.joints.length > 0) {
          updateSingleRagdoll(r.ragdoll.joints, 1);
        }
        if (r.cpuRagdoll.joints.length > 0) {
          updateSingleRagdoll(r.cpuRagdoll.joints, 2);
        }
      }

      // --- 4. PARTICLES UPDATE ---
      r.particles.forEach((p, index) => {
        p.pos.x += p.vel.x;
        p.pos.y += p.vel.y;
        p.vel.y += p.gravity;
        p.alpha -= p.decay;
        if (p.alpha <= 0) {
          r.particles.splice(index, 1);
        }
      });

      // --- 5. FLOATING TEXTS UPDATE ---
      r.floatingTexts.forEach((ft, index) => {
        ft.pos.y += ft.velocityY;
        ft.life -= 0.016;
        if (ft.life <= 0) {
          r.floatingTexts.splice(index, 1);
        }
      });

      // --- 6. COMPUTER AI PLAYER LOGIC ---
      if (r.mode === GameMode.VS_CPU && r.scoreState.currentTurn === 2 && (r.ballState === 'launcher' || r.ballState === 'drag')) {
        if (r.cpuCooldown === 0 && r.cpuShootDelay === 0) {
          r.cpuCooldown = 90; // Wait 1.5 seconds to start aiming
          r.cpuDragProgress = 0;
        }

        if (r.cpuCooldown > 0) {
          r.cpuCooldown--;
          if (r.cpuCooldown === 0) {
            // Trigger Aiming sequence
            r.ballState = 'drag';
            r.dragStart = { x: BALL_START_X, y: BALL_START_Y };
            
            // Calculate perfect physics vector to basket
            // Hoop target is at roughly x: 645, y: 185
            const targetX = h.rimX + 30;
            const targetY = h.rimY - 10;
            const dx = targetX - BALL_START_X;
            const dy = targetY - BALL_START_Y;
            
            // Standard ballistic trajectory approximation
            // We want a high peak arc (basketball swish)
            // Time to apex and time to target. We shoot for an apex height of y=60
            const peakHeight = 80;
            const apexY = Math.min(targetY, BALL_START_Y) - peakHeight;
            
            const g = 0.36; // Gravity constant per frame
            
            // Velocity up to apex:
            const h1 = BALL_START_Y - apexY;
            const vy0 = -Math.sqrt(2 * g * h1);
            
            // Time to reach target
            const t1 = -vy0 / g; // time to peak
            const h2 = targetY - apexY;
            const t2 = Math.sqrt(2 * h2 / g); // time from peak to target
            const totalFrames = t1 + t2;
            
            const vx0 = dx / totalFrames;

            // Add CPU Skill / Level variance error!
            // Lower scores / levels have wider error distribution
            const botLevel = r.scoreState.level;
            const precisionFactor = r.cpuPrecision || 1.0;
            const errorFactor = Math.max(0.04, (1.4 - botLevel * 0.25) / precisionFactor); // smaller error at higher levels and with higher learning precision
            const errorX = (Math.random() - 0.5) * 1.5 * errorFactor;
            const errorY = (Math.random() - 0.5) * 1.0 * errorFactor;

            r.cpuTargetVelocity = {
              x: vx0 + errorX,
              y: vy0 + errorY
            };
            r.cpuShootDelay = 50; // drag animation duration (approx 0.8 seconds)
          }
        } else if (r.cpuShootDelay > 0) {
          r.cpuShootDelay--;
          // Animate dragging back the ball
          r.cpuDragProgress += (1 / 50);
          
          if (r.cpuTargetVelocity) {
            // Map the calculated speed back to visual drag coordinates
            // Formula: velocity = dragDelta * 0.20
            // So dragDelta = velocity / 0.20
            const scaleForce = 0.20;
            const targetDragX = -r.cpuTargetVelocity.x / scaleForce;
            const targetDragY = -r.cpuTargetVelocity.y / scaleForce;

            r.dragCurrent = {
              x: BALL_START_X + targetDragX * r.cpuDragProgress,
              y: BALL_START_Y + targetDragY * r.cpuDragProgress
            };

            // Move ball along with the drag visually
            b.pos.x = r.dragCurrent.x;
            b.pos.y = r.dragCurrent.y;

            if (r.cpuShootDelay % 6 === 0) {
              gameAudio.playDragSound(r.cpuDragProgress);
            }
          }

          if (r.cpuShootDelay === 0 && r.cpuTargetVelocity) {
            // FIRE!
            b.vel = { ...r.cpuTargetVelocity };
            b.pos = { ...r.dragCurrent };
            r.ballState = 'flight';
            r.isDragging = false;
            r.cpuTargetVelocity = null;
            r.cpuDragProgress = 0;
            
            setScoreState((prev) => {
              const next = { ...prev };
              next.player2.shotsTaken += 1;
              return next;
            });

            gameAudio.playShootSound();
          }
        }
      }
    };

    const draw = () => {
      const r = stateRef.current;
      const b = r.ball;
      const h = r.hoop;

      // 1. CLEAR AND DRAW SUNSET BACKGROUND GRADIENT
      const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      bgGrad.addColorStop(0, '#0f172a'); // deep dark slate top
      bgGrad.addColorStop(0.5, '#1e1b4b'); // deep indigo dusk
      bgGrad.addColorStop(0.85, '#854d0e'); // warm golden brown glow
      bgGrad.addColorStop(1, '#ea580c'); // warm orange sunset
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Draw Retro Grid Lines on the Ground (Perspective)
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.08)';
      ctx.lineWidth = 1.5;
      const gridStartY = 410;
      for (let i = -10; i <= 20; i++) {
        ctx.beginPath();
        ctx.moveTo(WIDTH / 2 + i * 40, gridStartY);
        ctx.lineTo(WIDTH / 2 + i * 85, HEIGHT);
        ctx.stroke();
      }
      for (let y = gridStartY; y < HEIGHT; y += 15) {
        ctx.strokeStyle = `rgba(249, 115, 22, ${(y - gridStartY) / (HEIGHT - gridStartY) * 0.15})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
      }

      // Draw Palm Tree Silhouettes (Adds beautiful playground mood)
      ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
      const drawPalm = (x: number, height: number) => {
        ctx.beginPath();
        ctx.moveTo(x - 6, HEIGHT);
        ctx.quadraticCurveTo(x - 3, HEIGHT - height * 0.5, x, HEIGHT - height);
        ctx.quadraticCurveTo(x + 5, HEIGHT - height * 0.5, x + 6, HEIGHT);
        ctx.fill();

        // Fronds
        ctx.save();
        ctx.translate(x, HEIGHT - height);
        for (let f = 0; f < 8; f++) {
          ctx.rotate(Math.PI / 4);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(15, -12, 35, -5);
          ctx.quadraticCurveTo(15, 5, 0, 0);
          ctx.fill();
        }
        ctx.restore();
      };
      drawPalm(60, 180);
      drawPalm(100, 150);
      drawPalm(740, 160);

      // Draw wind indicator
      if (Math.abs(r.windForce) > 0.005) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '10px monospace';
        const windDir = r.windForce > 0 ? '→' : '←';
        const windIntensity = Math.abs(r.windForce * 40).toFixed(1);
        ctx.fillText(`WIND: ${windDir} ${windIntensity} MPH`, WIDTH / 2 - 50, 45);
      }

      // 2. DRAW THE COURT STAMPED DESIGN
      const courtY = 440;
      ctx.fillStyle = '#1e293b'; // Slate Court asphalt
      ctx.fillRect(0, courtY, WIDTH, HEIGHT - courtY);
      
      // Top court line (glowing line)
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(0, courtY);
      ctx.lineTo(WIDTH, courtY);
      ctx.stroke();
      ctx.shadowBlur = 0; // reset shadow

      // Court outlines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 2;
      ctx.strokeRect(30, courtY + 10, WIDTH - 60, HEIGHT - courtY - 20);
      
      // Key line
      ctx.strokeRect(550, courtY + 10, 220, HEIGHT - courtY - 20);

      // Draw Launcher Stand / Pedestal
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(BALL_START_X - 18, courtY);
      ctx.lineTo(BALL_START_X - 8, BALL_START_Y + 16);
      ctx.lineTo(BALL_START_X + 8, BALL_START_Y + 16);
      ctx.lineTo(BALL_START_X + 18, courtY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Launch cup holder
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(BALL_START_X, BALL_START_Y + 16, 12, 0, Math.PI, true);
      ctx.fill();

      // 3. DRAW SLINGSHOT TRAJECTORY PREVIEW (Only when dragging)
      if (r.ballState === 'drag') {
        const dx = r.dragStart.x - r.dragCurrent.x;
        const dy = r.dragStart.y - r.dragCurrent.y;
        const dragDist = Math.sqrt(dx * dx + dy * dy);
        
        // Elastic rubber band connecting the drag ball back to launch stand
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.45)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(r.dragStart.x, r.dragStart.y);
        ctx.lineTo(b.pos.x, b.pos.y);
        ctx.stroke();

        // Trajectory simulation
        const scaleForce = 0.20;
        const initialVel = { x: dx * scaleForce, y: dy * scaleForce };
        const maxForce = 24;
        // Cap initial velocities
        const currentSpeed = Math.sqrt(initialVel.x * initialVel.x + initialVel.y * initialVel.y);
        if (currentSpeed > maxForce) {
          initialVel.x = (initialVel.x / currentSpeed) * maxForce;
          initialVel.y = (initialVel.y / currentSpeed) * maxForce;
        }

        // Draw dotted flight line
        ctx.save();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 6]);
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 6;
        
        ctx.beginPath();
        let simX = r.dragStart.x;
        let simY = r.dragStart.y;
        let simVelX = initialVel.x;
        let simVelY = initialVel.y;
        
        ctx.moveTo(simX, simY);
        // Trace 40 physics simulation frames forward
        for (let step = 0; step < 40; step++) {
          simVelY += 0.36; // gravity
          simVelX += r.windForce; // wind
          simVelX *= 0.993; // friction
          simVelY *= 0.993;
          simX += simVelX;
          simY += simVelY;
          ctx.lineTo(simX, simY);
          if (simY > 440) break; // hits ground
        }
        ctx.stroke();
        ctx.restore();
      }

      // 4. DRAW THE NET (Hangs behind the ball and rim)
      const nodes = r.netNodes;
      if (nodes.length > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.lineWidth = 1.5;
        
        // Draw vertical hanging net lines
        for (let col = 0; col < 5; col++) {
          ctx.beginPath();
          ctx.moveTo(nodes[col].x, nodes[col].y);
          for (let row = 1; row < 5; row++) {
            const idx = row * 5 + col;
            ctx.lineTo(nodes[idx].x, nodes[idx].y);
          }
          ctx.stroke();
        }

        // Draw horizontal mesh crossing loops
        for (let row = 1; row < 5; row++) {
          ctx.beginPath();
          const startIdx = row * 5;
          ctx.moveTo(nodes[startIdx].x, nodes[startIdx].y);
          for (let col = 1; col < 5; col++) {
            const idx = startIdx + col;
            ctx.lineTo(nodes[idx].x, nodes[idx].y);
          }
          ctx.stroke();
        }
      }

      // 5. DRAW THE BASKETBALL HOOP & POLE
      // Hoop structure is at h.x
      // A. Backboard Support Pole
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(h.x + h.backboardWidth, HEIGHT);
      ctx.lineTo(h.x + h.backboardWidth, h.y + h.backboardHeight / 2);
      ctx.stroke();

      // B. Backboard Plexiglass
      // transparent white fill with thick border
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(h.x, h.y, h.backboardWidth, h.backboardHeight);
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 3;
      ctx.strokeRect(h.x, h.y, h.backboardWidth, h.backboardHeight);

      // Inner target box outline on backboard
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(h.x, h.y + h.backboardHeight - 40, h.backboardWidth, 30);

      // C. Rim Extension bar from backboard
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(h.x, h.rimY);
      ctx.lineTo(h.rimX + 60, h.rimY);
      ctx.stroke();

      // D. Glowing Orange Metal Hoop Rim
      // Front Rim Node
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(h.rimX, h.rimY);
      ctx.lineTo(h.rimX + 60, h.rimY);
      ctx.stroke();
      ctx.shadowBlur = 0; // reset

      // Rim circle pointers for visual reference
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(h.rimX, h.rimY, h.rimRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(h.rimX + 60, h.rimY, h.rimRadius, 0, Math.PI * 2);
      ctx.fill();

      // 6. DRAW THE BASKETBALL
      ctx.save();
      ctx.translate(b.pos.x, b.pos.y);
      ctx.rotate(b.rotation);

      // Ball Glowing Shadow (Orange core glow)
      ctx.shadowColor = 'rgba(249, 115, 22, 0.4)';
      ctx.shadowBlur = 12;

      // Ball Main Sphere Gradient (glowing leather leather finish)
      const ballGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, b.radius);
      ballGrad.addColorStop(0, '#fdba74'); // highlight peach
      ballGrad.addColorStop(0.3, '#f97316'); // core orange
      ballGrad.addColorStop(1, '#9a3412'); // shadow rust red
      ctx.fillStyle = ballGrad;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0; // reset shadow

      // Ball Outer outline
      ctx.strokeStyle = '#7c2d12';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw Seams (Stitched black rubber ribs)
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 1.2;

      // Vertical main seam
      ctx.beginPath();
      ctx.moveTo(0, -b.radius);
      ctx.lineTo(0, b.radius);
      ctx.stroke();

      // Horizontal main seam
      ctx.beginPath();
      ctx.moveTo(-b.radius, 0);
      ctx.lineTo(b.radius, 0);
      ctx.stroke();

      // Left curved rib
      ctx.beginPath();
      ctx.arc(-b.radius * 0.9, 0, b.radius * 0.7, -Math.PI / 2.5, Math.PI / 2.5);
      ctx.stroke();

      // Right curved rib
      ctx.beginPath();
      ctx.arc(b.radius * 0.9, 0, b.radius * 0.7, Math.PI - Math.PI / 2.5, Math.PI + Math.PI / 2.5);
      ctx.stroke();

      ctx.restore();

      // 6.5. DRAW HUMMAN RAGDOLL IF ACTIVE
      if (r.hummanEnabled) {
        const drawSingleRagdoll = (joints: RagdollJoint[], playerIndex: 1 | 2) => {
          const isAttached = playerIndex === 1 ? r.hummanAttached : r.cpuHummanAttached;
          const isKnockedOut = !isAttached && (playerIndex === 1 ? r.hummanReattachCooldown : r.cpuHummanReattachCooldown) > 0;
          
          let color = playerIndex === 1 ? HUMMAN_COLORS[r.hummanColorIndex || 0] : '#a855f7'; // purple robot skin
          let pattern = playerIndex === 1 ? HUMMAN_PATTERNS[r.hummanPatternIndex || 0] : 'matrix'; // cyber matrix pattern
          
          // Draw bones (limbs)
          ctx.save();
          ctx.strokeStyle = color;
          ctx.lineWidth = 4.5;
          ctx.lineCap = 'round';
          ctx.shadowColor = color;
          ctx.shadowBlur = pattern === 'glowing-aura' ? 18 : 4;

          if (pattern === 'striped') {
            ctx.setLineDash([6, 6]);
          } else if (pattern === 'polka-dot') {
            ctx.setLineDash([2, 8]);
          } else if (pattern === 'matrix') {
            ctx.setLineDash([12, 3, 3, 3]);
          } else {
            ctx.setLineDash([]);
          }

          // Torso (Chest index 2 to Pelvis index 4)
          ctx.beginPath();
          ctx.moveTo(joints[2].x, joints[2].y);
          ctx.lineTo(joints[4].x, joints[4].y);
          ctx.stroke();

          // Left arm (Chest index 2 to Left Hand index 0)
          ctx.beginPath();
          ctx.moveTo(joints[2].x, joints[2].y);
          ctx.lineTo(joints[0].x, joints[0].y);
          ctx.stroke();

          // Right arm (Chest index 2 to Right Hand index 1)
          ctx.beginPath();
          ctx.moveTo(joints[2].x, joints[2].y);
          ctx.lineTo(joints[1].x, joints[1].y);
          ctx.stroke();

          // Left leg (Pelvis index 4 to Left Foot index 5)
          ctx.beginPath();
          ctx.moveTo(joints[4].x, joints[4].y);
          ctx.lineTo(joints[5].x, joints[5].y);
          ctx.stroke();

          // Right leg (Pelvis index 4 to Right Foot index 6)
          ctx.beginPath();
          ctx.moveTo(joints[4].x, joints[4].y);
          ctx.lineTo(joints[6].x, joints[6].y);
          ctx.stroke();

          ctx.restore();

          // Draw head (index 3) and face on top!
          const head = joints[3];
          ctx.save();
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = pattern === 'glowing-aura' ? 18 : 6;
          ctx.beginPath();
          ctx.arc(head.x, head.y, head.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = playerIndex === 1 ? '#e0f2fe' : '#f5f3ff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();

          // Draw cute funny eyes & mouth
          ctx.save();
          const ballSpeed = Math.sqrt(b.vel.x * b.vel.x + b.vel.y * b.vel.y);
          
          if (playerIndex === 2) {
            // ROBOT CYBORG SKIN VISUALS!
            if (isKnockedOut) {
              // Dizzy screen cyber glitch face
              ctx.strokeStyle = '#0f172a';
              ctx.lineWidth = 1.8;
              ctx.lineCap = 'round';

              // Glitched X eyes
              ctx.beginPath();
              ctx.moveTo(head.x - 5, head.y - 3);
              ctx.lineTo(head.x - 1, head.y + 1);
              ctx.moveTo(head.x - 1, head.y - 3);
              ctx.lineTo(head.x - 5, head.y + 1);
              ctx.stroke();

              ctx.beginPath();
              ctx.moveTo(head.x + 1, head.y - 3);
              ctx.lineTo(head.x + 5, head.y + 1);
              ctx.moveTo(head.x + 5, head.y - 3);
              ctx.lineTo(head.x + 1, head.y + 1);
              ctx.stroke();

              // Cyber sparks indicator
              ctx.strokeStyle = '#ef4444';
              ctx.beginPath();
              ctx.moveTo(head.x - 3, head.y + 4);
              ctx.lineTo(head.x + 3, head.y + 4);
              ctx.stroke();
            } else {
              // Glowing robot visor!
              const visGlow = 1 + 0.4 * Math.sin(Date.now() * 0.01);
              ctx.strokeStyle = '#22d3ee'; // Neon Cyan visor
              ctx.lineWidth = 3 * visGlow;
              ctx.lineCap = 'round';
              ctx.beginPath();
              ctx.moveTo(head.x - 6, head.y - 2);
              ctx.lineTo(head.x + 6, head.y - 2);
              ctx.stroke();

              // vis highlight dot
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              const visDotOffset = Math.sin(Date.now() * 0.005) * 4;
              ctx.arc(head.x + visDotOffset, head.y - 2, 1, 0, Math.PI * 2);
              ctx.fill();

              // Cute binary mouth or speaker grill
              ctx.strokeStyle = '#22d3ee';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(head.x - 4, head.y + 3);
              ctx.lineTo(head.x - 2, head.y + 3);
              ctx.moveTo(head.x, head.y + 3);
              ctx.lineTo(head.x + 2, head.y + 3);
              ctx.stroke();
            }
          } else {
            // Normal human face
            ctx.fillStyle = '#0f172a';
            if (isKnockedOut) {
              // Dizzy / Knocked out face with "X X" eyes
              ctx.strokeStyle = '#0f172a';
              ctx.lineWidth = 1.8;
              ctx.lineCap = 'round';

              // Left Eye X
              ctx.beginPath();
              ctx.moveTo(head.x - 5, head.y - 3);
              ctx.lineTo(head.x - 1, head.y + 1);
              ctx.moveTo(head.x - 1, head.y - 3);
              ctx.lineTo(head.x - 5, head.y + 1);
              ctx.stroke();

              // Right Eye X
              ctx.beginPath();
              ctx.moveTo(head.x + 1, head.y - 3);
              ctx.lineTo(head.x + 5, head.y + 1);
              ctx.moveTo(head.x + 5, head.y - 3);
              ctx.lineTo(head.x + 1, head.y + 1);
              ctx.stroke();

              // Dizzy wiggly mouth
              ctx.beginPath();
              ctx.moveTo(head.x - 3, head.y + 3);
              ctx.quadraticCurveTo(head.x - 1.5, head.y + 1, head.x, head.y + 3);
              ctx.quadraticCurveTo(head.x + 1.5, head.y + 5, head.x + 3, head.y + 3);
              ctx.stroke();
            } else if (ballSpeed > 3.0) {
              // Scared face (screaming in flight!)
              // Left eye
              ctx.beginPath();
              ctx.arc(head.x - 3, head.y - 1.5, 2, 0, Math.PI * 2);
              ctx.fill();
              // Right eye
              ctx.beginPath();
              ctx.arc(head.x + 3, head.y - 1.5, 2, 0, Math.PI * 2);
              ctx.fill();
              // Screaming open mouth
              ctx.beginPath();
              ctx.arc(head.x, head.y + 3.5, 3, 0, Math.PI * 2);
              ctx.fill();
            } else {
              // Relaxed smiling face
              ctx.beginPath();
              ctx.arc(head.x - 3, head.y - 1, 1.5, 0, Math.PI * 2);
              ctx.arc(head.x + 3, head.y - 1, 1.5, 0, Math.PI * 2);
              ctx.fill();
              
              // Smile
              ctx.strokeStyle = '#0f172a';
              ctx.lineWidth = 1.5;
              ctx.lineCap = 'round';
              ctx.beginPath();
              ctx.arc(head.x, head.y + 1, 3.5, 0, Math.PI);
              ctx.stroke();
            }
          }
          ctx.restore();

          // Draw gloves (left and right hands: joint 0 and joint 1)
          const drawGlove = (jointIdx: number) => {
            const joint = joints[jointIdx];
            ctx.save();
            if (isKnockedOut) {
              // Pulsing bright red/orange glow
              const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.012);
              ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + pulse * 0.6})`; // Red
              ctx.shadowColor = '#ef4444';
              ctx.shadowBlur = 8 + pulse * 14;
              
              // Draw a bigger outer glow circle
              ctx.beginPath();
              ctx.arc(joint.x, joint.y, 8.5 + pulse * 3, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(239, 68, 68, ${0.15 + pulse * 0.15})`;
              ctx.fill();
              
              // Core glove
              ctx.beginPath();
              ctx.arc(joint.x, joint.y, 6.5, 0, Math.PI * 2);
              ctx.fillStyle = '#ef4444';
              ctx.fill();
              
              // Soft white/light red highlights on gloves
              ctx.strokeStyle = '#fca5a5';
              ctx.lineWidth = 1.5;
              ctx.stroke();
            } else {
              // Normal sporty athletic gloves (dark contrasting theme) or cyber gloves!
              ctx.fillStyle = playerIndex === 1 ? '#0f172a' : '#22d3ee';
              ctx.shadowBlur = playerIndex === 2 ? 6 : 0;
              ctx.shadowColor = '#22d3ee';
              ctx.beginPath();
              ctx.arc(joint.x, joint.y, 5.5, 0, Math.PI * 2);
              ctx.fill();
              
              ctx.strokeStyle = playerIndex === 1 ? '#475569' : '#0891b2';
              ctx.lineWidth = 1;
              ctx.stroke();
            }
            ctx.restore();
          };

          drawGlove(0); // Left hand
          drawGlove(1); // Right hand
        };

        if (r.ragdoll.joints.length > 0) {
          drawSingleRagdoll(r.ragdoll.joints, 1);
        }
        if (r.cpuRagdoll.joints.length > 0) {
          drawSingleRagdoll(r.cpuRagdoll.joints, 2);
        }
      }

      // 7. DRAW PARTICLES
      r.particles.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 8. DRAW FLOATING TEXT NOTIFICATIONS
      r.floatingTexts.forEach((ft) => {
        ctx.save();
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 13px sans-serif';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.pos.x, ft.pos.y);
        ctx.restore();
      });

      // 9. CPU MOOD OVERLAY EMOTE (A cute floating chat bubble)
      if (r.mode === GameMode.VS_CPU) {
        let text = '';
        let showBubble = false;
        
        if (scoreState.currentTurn === 2) {
          showBubble = true;
          if (r.cpuCooldown > 0) {
            text = "🤖 Thinking...";
          } else if (r.cpuShootDelay > 0) {
            text = "🤖 Aiming!";
          }
        }
        
        if (showBubble && text) {
          ctx.save();
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          const bubbleX = 460;
          const bubbleY = 80;
          ctx.fillRect(bubbleX, bubbleY, 100, 30);
          ctx.strokeRect(bubbleX, bubbleY, 100, 30);
          
          ctx.fillStyle = '#f8fafc';
          ctx.font = '11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(text, bubbleX + 50, bubbleY + 18);
          ctx.restore();
        }
      }
    };

    const loop = () => {
      updatePhysics();
      draw();
      animFrameId = requestAnimationFrame(loop);
    };

    animFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [scoreState, setScoreState, mode, audioSettings, hummanEnabled]);


  // --- BULLETPROOF TOUCH & MOUSE EVENT DRAG LOGIC ---
  
  // Custom Hook or direct DOM binding for native touch listeners (essential to prevent default page scrolling in iframes)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getCanvasMousePos = (clientX: number, clientY: number): Vector2D => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = WIDTH / rect.width;
      const scaleY = HEIGHT / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    };

    const handleStart = (clientX: number, clientY: number, e: Event) => {
      const r = stateRef.current;
      const b = r.ball;
      const pos = getCanvasMousePos(clientX, clientY);

      // 1. Check if user tapped the Human Ragdoll (anywhere on any joint)
      if (r.hummanEnabled && r.ragdoll.joints.length > 0) {
        // Find if tap is close to any joint
        const tappedJoint = r.ragdoll.joints.find(j => {
          const distance = Math.sqrt((pos.x - j.x) * (pos.x - j.x) + (pos.y - j.y) * (pos.y - j.y));
          return distance <= (j.radius + 15); // generous tap area around each joint
        });

        if (tappedJoint) {
          e.preventDefault();
          
          r.hummanColorIndex = ((r.hummanColorIndex || 0) + 1) % HUMMAN_COLORS.length;
          // Every time we loop color, cycle the pattern too
          if (r.hummanColorIndex % 2 === 0) {
            r.hummanPatternIndex = ((r.hummanPatternIndex || 0) + 1) % HUMMAN_PATTERNS.length;
          }

          gameAudio.playBounceSound(0.4);
          
          const newColorName = HUMMAN_COLORS[r.hummanColorIndex];
          const newPatternName = HUMMAN_PATTERNS[r.hummanPatternIndex].toUpperCase();

          r.floatingTexts.push({
            pos: { x: tappedJoint.x, y: tappedJoint.y - 25 },
            text: `✨ ${newPatternName} STYLE!`,
            color: newColorName,
            life: 1.0,
            velocityY: -1.5
          });

          // Burst some small styling particles!
          for (let i = 0; i < 12; i++) {
            r.particles.push({
              pos: { x: tappedJoint.x, y: tappedJoint.y },
              vel: { x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 6 },
              color: newColorName,
              size: Math.random() * 3 + 2,
              alpha: 1.0,
              decay: 0.03,
              gravity: 0.1
            });
          }
          return; // Stop processing dragging since they interacted with the humman!
        }
      }

      // 2. Normal Drag / Launcher grab
      // Prevent starting if ball is already launched or resetting
      if (r.ballState !== 'launcher') return;
      
      // Also prevent if it is the CPU's turn
      if (r.mode === GameMode.VS_CPU && r.scoreState.currentTurn === 2) return;

      // In human mode, do not allow shooting if the human is unattached and crawling!
      if (r.hummanEnabled && !r.hummanAttached) {
        if (r.floatingTexts.filter(t => t.text === 'WAIT FOR RAGDOLL!').length === 0) {
          r.floatingTexts.push({
            pos: { x: b.pos.x, y: b.pos.y - 35 },
            text: 'WAIT FOR RAGDOLL!',
            color: '#ef4444',
            life: 1.0,
            velocityY: -1.2
          });
        }
        return;
      }

      // Check if distance to ball is close enough
      const dx = pos.x - b.pos.x;
      const dy = pos.y - b.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Generous grab radius (touch targets need to be big)
      if (dist <= b.radius * 2.5) {
        e.preventDefault(); // Stop mobile scrolling or text selection
        r.isDragging = true;
        r.ballState = 'drag';
        r.dragStart = { x: b.pos.x, y: b.pos.y };
        r.dragCurrent = pos;

        // Visual feedback
        b.pos = pos;
        gameAudio.playDragSound(0.1);
      }
    };

    const handleMove = (clientX: number, clientY: number, e: Event) => {
      const r = stateRef.current;
      const b = r.ball;
      if (!r.isDragging) return;

      e.preventDefault(); // crucial to prevent standard browser scroll when dragging!
      const pos = getCanvasMousePos(clientX, clientY);
      
      // Limit drag distance to avoid infinite launcher power
      const dx = r.dragStart.x - pos.x;
      const dy = r.dragStart.y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDrag = 120; // max slingshot extension

      if (dist > maxDrag) {
        const angle = Math.atan2(dy, dx);
        r.dragCurrent = {
          x: r.dragStart.x - Math.cos(angle) * maxDrag,
          y: r.dragStart.y - Math.sin(angle) * maxDrag,
        };
      } else {
        r.dragCurrent = pos;
      }

      // Sync ball coordinates to the dragged elastic spot
      b.pos = r.dragCurrent;

      // Play escalating tension tick sounds depending on drag stretch
      if (Math.random() < 0.15) {
        const tension = Math.min(1.0, dist / maxDrag);
        gameAudio.playDragSound(tension);
      }
    };

    const handleEnd = (e: Event) => {
      const r = stateRef.current;
      const b = r.ball;
      if (!r.isDragging) return;

      e.preventDefault();
      r.isDragging = false;

      // Calculate throwing velocity vector
      const dx = r.dragStart.x - r.dragCurrent.x;
      const dy = r.dragStart.y - r.dragCurrent.y;
      
      const scaleForce = 0.20; // mapping force to velocity constant (allows farther throwing)
      b.vel.x = dx * scaleForce;
      b.vel.y = dy * scaleForce;

      // Velocity caps to prevent infinite breaking speed (larger cap for far throws)
      const maxForce = 24;
      const speed = Math.sqrt(b.vel.x * b.vel.x + b.vel.y * b.vel.y);
      if (speed > maxForce) {
        b.vel.x = (b.vel.x / speed) * maxForce;
        b.vel.y = (b.vel.y / speed) * maxForce;
      }

      // Rotate initially in the direction of the throw
      b.angularVelocity = b.vel.x * 0.05;

      // Change ball state to flight
      r.ballState = 'flight';

      // Increment shots taken!
      setScoreState((prev) => {
        const next = { ...prev };
        if (r.mode === GameMode.PRACTICE) {
          next.player1.shotsTaken += 1;
        } else {
          if (prev.currentTurn === 1) {
            next.player1.shotsTaken += 1;
          } else {
            next.player2.shotsTaken += 1;
          }
        }
        return next;
      });
      
      // Play release shooting swoosh!
      gameAudio.playShootSound();
    };

    // --- BIND HTML5 CANVAS MOUSE LISTENERS ---
    const onMouseDown = (e: MouseEvent) => handleStart(e.clientX, e.clientY, e);
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY, e);
    const onMouseUp = (e: MouseEvent) => handleEnd(e);

    canvas.addEventListener('mousedown', onMouseDown);
    // Bind move and up to window so if the user drags off-canvas and releases, it still fires correctly!
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // --- BIND TOUCH LISTENERS DIRECTLY WITH { PASSIVE: FALSE } ---
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleStart(e.touches[0].clientX, e.touches[0].clientY, e);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY, e);
      }
    };
    const onTouchEnd = (e: TouchEvent) => handleEnd(e);

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  return (
    <div className="relative w-full aspect-[8/5] max-w-4xl mx-auto rounded-3xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950" id="canvas-game-viewport">
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
        id="basketball-physics-canvas"
      />

      {/* Floating Instructions Overlay */}
      {scoreState.player1.shotsTaken === 0 && mode === GameMode.PRACTICE && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-[1px] animate-fade-out" style={{ animationDelay: '5s', animationFillMode: 'forwards' }}>
          <div className="bg-slate-900/90 border border-slate-700/50 p-4 rounded-xl text-center shadow-lg max-w-xs transform scale-95 animate-pulse-slow">
            <p className="text-white text-xs font-semibold mb-1">🏀 Drag and Pull Back the Ball!</p>
            <p className="text-slate-400 text-[10px]">Pull further backward to shoot further, just like a slingshot. Release to throw!</p>
          </div>
        </div>
      )}
    </div>
  );
}
