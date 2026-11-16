import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptiveCalorieSuggestion, targetsForDay } from './adaptive.ts';
import type { BodyweightEntry, FoodEntry, NutritionPhase } from '../types/index.ts';
const phase: NutritionPhase = { id:'p', goal:'bulk', name:'Bulk', startDate:'2026-01-01', calories:3000, protein:150, carbs:400, fat:80, weeklyChange:0.2 };
test('adaptive coach waits for enough weigh-ins and food logs', () => {
  const result = adaptiveCalorieSuggestion([], [], phase);
  assert.equal(result.status, 'insufficient-data');
});
test('rest day targets fall back to normal targets when not configured', () => {
  assert.deepEqual(targetsForDay(phase, false), { calories:3000, protein:150, carbs:400, fat:80 });
});
test('rest day overrides only configured targets', () => {
  assert.deepEqual(targetsForDay({...phase, restDayCalories:2800, restDayCarbs:350}, false), { calories:2800, protein:150, carbs:350, fat:80 });
});
test('adequate data produces an on-track or suggested result without changing phase', () => {
  const weights: BodyweightEntry[] = Array.from({length:22}, (_,i)=>({date:new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10),weight:70+i*0.03}));
  const foods: FoodEntry[] = Array.from({length:14},(_,i)=>({id:String(i),date:new Date(Date.UTC(2026,0,9+i)).toISOString().slice(0,10),name:'day',calories:3000,protein:150,carbs:400,fat:80,fibre:25,createdAt:i}));
  const result = adaptiveCalorieSuggestion(weights,foods,phase,'kg','2026-01-22');
  assert.ok(['on-track','adjustment-suggested'].includes(result.status));
  assert.equal(phase.calories,3000);
});
test('slow bulk trend suggests a small calorie increase and uses a goal-based rate when none is configured', () => {
  const weights: BodyweightEntry[] = Array.from({length:22}, (_,i)=>({date:new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10),weight:70}));
  const foods: FoodEntry[] = Array.from({length:14},(_,i)=>({id:String(i),date:new Date(Date.UTC(2026,0,9+i)).toISOString().slice(0,10),name:'day',calories:3000,protein:150,carbs:400,fat:80,fibre:25,createdAt:i}));
  const result = adaptiveCalorieSuggestion(weights,foods,{...phase,weeklyChange:undefined},'kg','2026-01-22');
  assert.equal(result.status,'adjustment-suggested');
  assert.equal(result.suggestedCalories,3100);
  assert.ok((result.targetRate ?? 0)>0);
});
test('adaptive coach refuses to recommend from stale weigh-ins', () => {
  const weights: BodyweightEntry[] = Array.from({length:22}, (_,i)=>({date:new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10),weight:70+i*0.01}));
  const foods: FoodEntry[] = Array.from({length:14},(_,i)=>({id:String(i),date:new Date(Date.UTC(2026,0,9+i)).toISOString().slice(0,10),name:'day',calories:3000,protein:150,carbs:400,fat:80,fibre:25,createdAt:i}));
  assert.equal(adaptiveCalorieSuggestion(weights,foods,phase,'kg','2026-02-10').status,'insufficient-data');
});
