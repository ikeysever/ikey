const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
let now=0,frames=[];
class Element {
 constructor(){this.classList={add(){},remove(){}};this.style={};this.children=[];this.hidden=false;this.textContent='';}
 set innerHTML(v){this.primary=new Element();this.secondary=new Element();this.spinner=new Element();}
 querySelector(s){return s==='[data-primary]'?this.primary:s==='[data-secondary]'?this.secondary:this.spinner;}
 append(...v){this.children.push(...v)} replaceChildren(){this.children=[]} setAttribute(){}
 getContext(){return new Proxy({measureText:()=>({width:28})},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)})}
}
const sandbox={window:{},document:{createElement:()=>new Element(),fonts:{load:async()=>{}},addEventListener(){}},Image:class{set src(v){Promise.resolve().then(()=>this.onload())}},performance:{now:()=>now},requestAnimationFrame:f=>frames.push(f),console};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../public/welcome.js'),'utf8'),sandbox);
async function step(t){now=t;for(let i=0;i<15;i++)await Promise.resolve();const run=frames;frames=[];run.forEach(f=>f(now));for(let i=0;i<15;i++)await Promise.resolve()}
(async()=>{
 const root=new Element();let release,done=false;
 sandbox.window.iKeyWelcome.play(root,()=>new Promise(r=>release=r)).then(()=>done=true);
 await step(0);await step(8300);await step(11000);
 assert.equal(root.children[1].primary.textContent,'登入成功');assert.equal(done,false);
 release();await step(11100);assert.equal(root.children[1].primary.textContent,'載入成功');
 await step(12600);assert.equal(done,true);assert.equal(root.children.length,0);
 let tries=0;done=false;
 sandbox.window.iKeyWelcome.play(root,async()=>{if(++tries===1)throw Error('offline')}).then(()=>done=true);
 await step(13000);await step(24000);
 assert.equal(root.children[1].primary.textContent,'載入失敗');assert.equal(done,false);
 assert.equal(root.children[2].hidden,false);root.children[2].children[0].onclick();
 await step(24100);await step(25700);assert.equal(done,true);
 console.log('PASS: delayed readiness, failure without success, retry, cleanup and repeated playback.');
})();
