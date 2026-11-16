import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId } from '../../db/db.ts';
import { todayISO } from '../../core/calendar/dates.ts';
import type { Recipe, RecipeIngredient } from '../../core/types/index.ts';

const blank = (): Recipe => ({ id:newId(), name:'', servings:1, ingredients:[], calories:0, protein:0, carbs:0, fat:0, fibre:0, createdAt:Date.now(), updatedAt:Date.now() });
export default function Recipes() {
 const recipes = useLiveQuery(()=>db.recipes.orderBy('updatedAt').reverse().toArray(),[]) ?? [];
 const meals = useLiveQuery(()=>db.settings.get('settings'),[]);
 const [edit,setEdit]=useState<Recipe|null>(null), [date,setDate]=useState(todayISO()), [mealId,setMealId]=useState(''), [servings,setServings]=useState<Record<string,number>>({}), [message,setMessage]=useState('');
 const patch=(p:Partial<Recipe>)=>setEdit(x=>x?({...x,...p}):x);
 const ingredient=(id:string,p:Partial<RecipeIngredient>)=>patch({ingredients:edit!.ingredients.map(x=>x.id===id?{...x,...p}:x)});
 const save=async()=>{if(!edit?.name.trim())return setMessage('Give your recipe a name.'); if(edit.servings<1)return setMessage('Servings must be at least one.'); await db.recipes.put({...edit,name:edit.name.trim(),updatedAt:Date.now()});setEdit(null);setMessage('Recipe saved.');};
 const preload=async(r:Recipe)=>{const n=Math.max(.25,servings[r.id]??1);const m=meals?.nutritionSchedule?.meals.find(x=>x.id===(mealId||'')) ?? meals?.nutritionSchedule?.meals.find(x=>x.enabled);await db.foods.put({id:newId(),date,name:`${r.name} (${n} serving${n===1?'':'s'})`,calories:r.calories*n,protein:r.protein*n,carbs:r.carbs*n,fat:r.fat*n,fibre:r.fibre*n,createdAt:Date.now(),mealId:m?.id,source:'manual'});setMessage(`${r.name} added to ${date}.`);};
 if(edit)return <div className="card recipe-editor"><div className="cmp-head"><h2>{recipes.some(r=>r.id===edit.id)?'Edit recipe':'Create recipe'}</h2><button className="btn ghost sm" onClick={()=>setEdit(null)}>Cancel</button></div>
  <label>Recipe name<input value={edit.name} onChange={e=>patch({name:e.target.value})} placeholder="e.g. Chicken rice bowl"/></label>
  <label>Number of servings<input type="number" min="1" value={edit.servings} onChange={e=>patch({servings:Number(e.target.value)})}/></label>
  <div className="ci-sec">Ingredients</div>{edit.ingredients.map(i=><div className="row" key={i.id}><input aria-label="Ingredient" placeholder="Ingredient" value={i.name} onChange={e=>ingredient(i.id,{name:e.target.value})}/><input aria-label="Quantity" placeholder="Quantity" value={i.quantity} onChange={e=>ingredient(i.id,{quantity:e.target.value})}/><button className="btn ghost sm" onClick={()=>patch({ingredients:edit.ingredients.filter(x=>x.id!==i.id)})}>Remove</button></div>)}
  <button className="btn ghost sm" onClick={()=>patch({ingredients:[...edit.ingredients,{id:newId(),name:'',quantity:''}]})}>+ Add ingredient</button>
  <div className="ci-sec">Nutrition per serving</div><div className="recipe-macros">{(['calories','protein','carbs','fat','fibre'] as const).map(k=><label key={k}>{k==='calories'?'Calories (kcal)':`${k} (g)`}<input type="number" min="0" value={edit[k]} onChange={e=>patch({[k]:Math.max(0,Number(e.target.value))})}/></label>)}</div>
  <label>Preparation notes<textarea rows={3} value={edit.instructions??''} onChange={e=>patch({instructions:e.target.value})}/></label>
  {message&&<p className="muted">{message}</p>}<button className="btn" onClick={save}>Save recipe</button></div>;
 return <div className="card"><div className="cmp-head"><div><h2>Recipe library</h2><p className="muted sm2">Save meals once, then add servings directly to a day’s food log.</p></div><button className="btn" onClick={()=>{setMessage('');setEdit(blank())}}>+ Create recipe</button></div>
 <div className="row"><label>Plan for date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Meal slot<select value={mealId} onChange={e=>setMealId(e.target.value)}><option value="">First enabled meal</option>{(meals?.nutritionSchedule?.meals??[]).filter(m=>m.enabled).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label></div>{message&&<p role="status" className="chip">{message}</p>}
 {recipes.map(r=><div className="recipe-tile" key={r.id}><div className="recipe-main"><strong>{r.name}</strong><span className="muted sm2">{r.servings} servings · {r.ingredients.length} ingredients</span><span className="sm2">{Math.round(r.calories)} kcal · P {r.protein}g · C {r.carbs}g · F {r.fat}g per serving</span></div><div className="recipe-actions"><label>Servings<input aria-label={`Servings for ${r.name}`} type="number" min="0.25" step="0.25" value={servings[r.id]??1} onChange={e=>setServings(x=>({...x,[r.id]:Number(e.target.value)}))}/></label><button className="btn sm" onClick={()=>void preload(r)}>Add to day</button><button className="btn ghost sm" onClick={()=>setEdit(r)}>Edit</button><button className="btn ghost sm" onClick={()=>{if(confirm(`Delete ${r.name}?`))void db.recipes.delete(r.id)}}>Delete</button></div>{r.instructions&&<details><summary className="muted sm2">Preparation</summary><p className="sm2">{r.instructions}</p></details>}</div>)}
 {recipes.length===0&&<p className="muted">No recipes yet. Create your first recipe to start planning ahead.</p>}</div>;
}
