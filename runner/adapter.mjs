import { createRequire } from 'node:module';const require=createRequire(import.meta.url);const C=require('../companion/core.js');
export function samePreferences(a,b){return ['city','department','centre','doctor','date','start','end'].every(k=>C.normalize(a[k])===C.normalize(b[k]));}
export function inspectSlots(slots,p){const candidates=slots.filter(s=>!s.disabled&&!/booked|disabled|danger/i.test(s.flags||'')&&/slot\s*\w+/i.test(s.text)&&C.minutes(s.text)!==null&&C.minutes(s.text)>=C.minutes(p.start)&&C.minutes(s.text)<=C.minutes(p.end)&&!C.red(s.color)&&!C.red(s.border)&&(C.green(s.color)||C.green(s.border)||C.green(s.background))).sort((a,b)=>C.minutes(a.text)-C.minutes(b.text));if(!candidates.length)return {status:'unavailable'};const n=C.minutes(candidates[0].text);return {status:'available',time:String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')};}
export async function capture(page,plan){
 const fields={};for(const k of ['city','department','centre','doctor']){
  const found=await page.locator('select').evaluateAll((els,wanted)=>els.filter(el=>el.selectedOptions[0]?.textContent?.replace(/\s+/g,' ').trim().toLowerCase()===wanted.toLowerCase()).map(el=>{if(el.id)return '#'+CSS.escape(el.id);let a=[],n=el;while(n&&n!==document.body){let pr=n.parentElement;if(!pr)break;const siblings=[...pr.children].filter(x=>x.localName===n.localName);a.unshift(n.localName+':nth-of-type('+(siblings.indexOf(n)+1)+')');n=pr;}return 'body > '+a.join(' > ');}),plan[k].replace(/\s+/g,' ').trim());
  if(found.length!==1)throw Error('Select the exact '+k+' from the plan on CGHS. Exactly one underlying dropdown is required.');fields[k]=found[0];
 }
 return fields;
}
export async function check(page,fields,plan){
 const url=new URL(page.url());if(!['cghs.mohfw.gov.in','www.cghs.mohfw.gov.in'].includes(url.hostname))return {status:'needs_login'};
 const text=await page.locator('body').innerText();if(/please sign.in|session (expired|timeout)|verify you are human|checking your browser|access denied/i.test(text)||await page.locator('input[type=password]:visible').count())return {status:'needs_login'};
 for(const k of ['city','department','centre','doctor']){const s=page.locator(fields[k]);if(await s.count()!==1)return {status:'needs_setup'};const value=await s.evaluate(el=>el.selectedOptions[0]?.textContent);if(C.normalize(value)!==C.normalize(plan[k]))return {status:'needs_setup'};}
 const candidates=page.locator('button,a,[role=button],div[onclick],span[onclick]');const dates=await candidates.all();let target=null;
 for(const el of dates){if(await el.isVisible()&&C.isoDate(await el.innerText())===plan.date){target=el;break;}}
 if(!target){await page.locator(fields.doctor).dispatchEvent('change');return {status:'unavailable'};}
 await target.click({timeout:5000});
 try{await page.waitForFunction(expected=>{const s=document.body.innerText.match(/Select Time Slot for Appointment Date[-\s:]*(\d{1,2})-([A-Za-z]{3})-(\d{4})/i);if(!s)return false;const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];const mo=months.indexOf(s[2].toLowerCase())+1;return `${s[3]}-${String(mo).padStart(2,'0')}-${s[1].padStart(2,'0')}`===expected;},plan.date,{timeout:8000});}catch{return {status:'needs_setup'};}
 // A short bounded wait allows the portal's async slot render to settle; never submit from this worker.
 await page.waitForTimeout(1500);
 const slots=await candidates.evaluateAll(els=>els.filter(el=>el.getClientRects().length).map(el=>{const s=getComputedStyle(el);return {text:el.innerText,disabled:el.disabled||el.getAttribute('aria-disabled')==='true',flags:String(el.className)+' '+el.getAttribute('aria-label'),color:s.color,border:s.borderTopColor,background:s.backgroundColor};}));
 return inspectSlots(slots,plan);
}
