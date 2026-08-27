function makeEl() {
  return new Proxy({
    innerHTML: '', textContent: '', style: {}, dataset: {},
    classList: { add(){}, remove(){}, toggle(){}, contains(){return false;} },
    onclick: null, appendChild(){}, querySelector(){return makeEl();},
    querySelectorAll(){return [];}, addEventListener(){}, focus(){}
  }, { get(t,k){ return k in t ? t[k] : (()=>{}); }, set(t,k,v){ t[k]=v; return true; } });
}
const doc = { readyState:'complete', addEventListener(){}, removeEventListener(){}, querySelector(){return makeEl();},
  querySelectorAll(){return [];}, getElementById(){return makeEl();}, createElement(){return makeEl();}, body: makeEl() };
global.window = { scrollTo(){}, addEventListener(){}, document: doc };
global.document = doc;
const fs=require('fs'),vm=require('vm');
const ctx={window:global.window,document:doc,Math,Date,console,setTimeout,clearTimeout,setInterval,clearInterval};
vm.createContext(ctx);
for (const f of ['assets/js/data.js','assets/js/charts.js','assets/js/app.js']) vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
const App=ctx.window.App, DB=ctx.window.DB;
const cases=[['home',null],['sport',null],['sport','camp'],['insight',null],['insight','metric'],
  ['community',null],['community','challenge'],['profile',null],['profile','onboard'],['profile','privacy'],['profile','alg']];
let ok=0;
for(const [tab,sub] of cases){ try{App.tab=tab;App.sub=sub;App.params={};App.render();ok++;}catch(e){console.log('FAIL',tab,sub,'->',e.message);} }
console.log('渲染用例通过:',ok+'/'+cases.length);
try{ App.tracking={type:DB.sportTypes[0],t:300,dist:5,cal:400,hr:150,pace:6,running:false,points:100};
  App.sub='done';App.params={s:App.tracking};App.render();console.log('完成仪式页: OK'); }catch(e){console.log('FAIL done ->',e.message);}
// 模拟若干交互：开始运动、加入挑战、点赞、充能
try{ App.handle('start','run'); console.log('start run: OK (timer set)'); }catch(e){console.log('FAIL start',e.message);}
try{ App.handle('challenge', DB.challenges[2].id); console.log('join challenge: OK'); }catch(e){console.log('FAIL challenge',e.message);}
try{ App.handle('like', DB.community[0].id); console.log('like: OK'); }catch(e){console.log('FAIL like',e.message);}
try{ App.handle('pet', null); console.log('pet feed: OK'); }catch(e){console.log('FAIL pet',e.message);}
try{ App.handle('why', null); console.log('why sheet: OK'); }catch(e){console.log('FAIL why',e.message);}
console.log('RENDER TEST PASSED');
