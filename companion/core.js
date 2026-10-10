(function(root){
const normalize=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();
function minutes(s){const m=String(s).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);if(!m)return null;let h=+m[1],n=+m[2];if(n>59||h>23||m[3]&&(h<1||h>12))return null;if(m[3])h=h%12+(/pm/i.test(m[3])?12:0);return h*60+n;}
function isoDate(s){const m=String(s).replace(/\s+/g,'').match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/);if(!m)return null;const mo=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[2].toLowerCase());return mo<0?null:`${m[3]}-${String(mo+1).padStart(2,'0')}-${m[1].padStart(2,'0')}`;}
function green(s){const m=String(s).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);return !!m&&+m[2]>70&&+m[2]>+m[1]*1.25&&+m[2]>+m[3]*1.1;}
function red(s){const m=String(s).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);return !!m&&+m[1]>140&&+m[1]>+m[2]*1.5&&+m[1]>+m[3]*1.2;}
function validPlan(p){return p&&p.version===1&&(!p.watchStart||Number.isFinite(Date.parse(p.watchStart)))&&/^\d{4,20}$/.test(p.beneficiaryId)&&['city','department','centre','doctor'].every(k=>typeof p[k]==='string'&&p[k].trim().length>1)&&/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&minutes(p.start)!==null&&minutes(p.end)!==null&&minutes(p.start)<=minutes(p.end)&&[60,120,300].includes(p.interval)&&['notify','auto'].includes(p.mode);}
const api={normalize,minutes,isoDate,green,red,validPlan};root.SlotCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
