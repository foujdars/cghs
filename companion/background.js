chrome.runtime.onMessage.addListener((m,s,reply)=>{
 if(m.type==='load') {chrome.storage.session.get('plan').then(reply);return true;}
 if(m.type==='plan' && s.url?.startsWith(chrome.runtime.getURL(''))) {chrome.storage.session.set({plan:m.plan}).then(()=>reply({ok:true}));return true;}
});
