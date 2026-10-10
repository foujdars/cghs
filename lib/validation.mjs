export function validateWatch(input,now=new Date()){
 const p=input?.preferences;const runner=input?.runnerId;if(!p||typeof runner!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(runner))throw new Error('invalid_runner');
 const preferences={};for(const k of ['city','department','centre','doctor']){if(typeof p[k]!=='string'||p[k].trim().length<2||p[k].length>160)throw new Error('invalid_preferences');preferences[k]=p[k].trim();}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||new Date(p.date+'T00:00:00Z').toISOString().slice(0,10)!==p.date)throw new Error('invalid_date');
 for(const k of ['start','end'])if(typeof p[k]!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p[k]))throw new Error('invalid_time');
 if(p.start>p.end)throw new Error('invalid_time_range');Object.assign(preferences,{date:p.date,start:p.start,end:p.end});
 const interval=Number(input.intervalSeconds);if(![60,120,300,600].includes(interval))throw new Error('invalid_interval');
 const starts=input.startsAt?new Date(input.startsAt):now;const expires=new Date(p.date+'T23:59:59+05:30');if(!Number.isFinite(starts.getTime())||expires<=now||starts>=expires)throw new Error('invalid_schedule');
 return {runner_id:runner,preferences,interval_seconds:interval,starts_at:starts.toISOString(),expires_at:expires.toISOString(),next_check:starts.toISOString(),enabled:true,status:'waiting'};
}
export function validateResult(x){if(!x||!['unavailable','available','needs_login','needs_setup','error'].includes(x.status))throw new Error('invalid_status');const result={status:x.status};if(x.status==='available'){if(typeof x.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(x.time))throw new Error('invalid_result_time');result.time=x.time;}return result;}
