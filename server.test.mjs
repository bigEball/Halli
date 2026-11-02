import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';

test('admin authentication, safe edits, photo upload, backup, and restart persistence',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'halli-admin-test-'));
 const port=14173;const base=`http://127.0.0.1:${port}`;let child;
 async function start(){child=spawn(process.execPath,['server.mjs'],{cwd:new URL('.',import.meta.url),env:{...process.env,PORT:String(port),HALLI_DATA_DIR:directory,HALLI_ADMIN_PASSWORD:'halli'},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server did not start')),5000);child.stdout.on('data',data=>{if(data.toString().includes('running at')){clearTimeout(timer);resolve();}});child.on('exit',code=>{clearTimeout(timer);reject(Error(`Server exited: ${code}`));});});}
 async function stop(){if(child&&child.exitCode===null){child.kill();await once(child,'exit');}}
 try{
 await start();
 assert.equal((await fetch(base)).status,200);
 assert.equal((await fetch(base+'/admin')).status,200);
 assert.deepEqual(await(await fetch(base+'/api/admin/session')).json(),{authenticated:false});
 assert.equal((await fetch(base+'/api/admin/content',{method:'PUT',body:'{}'})).status,401);
 assert.equal((await fetch(base+'/api/admin/login',{method:'POST',body:JSON.stringify({password:'wrong'})})).status,401);
 let response=await fetch(base+'/api/admin/login',{method:'POST',body:JSON.stringify({password:'halli'})});assert.equal(response.status,200);
 const cookie=response.headers.get('set-cookie').split(';')[0];const {csrf}=await response.json();
 assert.match(response.headers.get('set-cookie'),/HttpOnly/);assert.match(response.headers.get('set-cookie'),/SameSite=Strict/);
 assert.equal((await fetch(base+'/api/admin/content',{method:'PUT',headers:{Cookie:cookie},body:'{}'})).status,403);
 const headers={Cookie:cookie,'X-CSRF-Token':csrf,'Content-Type':'application/json'};
 assert.equal((await fetch(base+'/api/admin/content',{method:'PUT',headers:{...headers,Origin:'https://other.example'},body:'{}'})).status,403);
 assert.equal((await fetch(base+'/api/admin/content',{method:'PUT',headers,body:JSON.stringify({fields:{'link-1':'javascript:alert(1)'}})})).status,400);
 const config={version:1,fields:{'text-0':'Saved headline','contact-phone':'425-395-5021','image-0':'/uploads/example.png'},collections:{color:[{title:'Custom color',description:'A personal color service.',price:'$120'}]},theme:{paper:'#ffffff',textScale:1.1},hidden:{faq:true},order:['about','hero']};
 response=await fetch(base+'/api/admin/content',{method:'PUT',headers,body:JSON.stringify(config)});assert.equal(response.status,200);const saved=(await response.json()).content;assert.deepEqual(await(await fetch(base+'/api/content')).json(),saved);
 response=await fetch(base+'/api/admin/content',{method:'PUT',headers,body:JSON.stringify({...config,fields:{'text-0':'Second headline'}})});assert.equal(response.status,200);assert.deepEqual(JSON.parse(await readFile(join(directory,'content.backup.json'),'utf8')),saved);
 assert.equal((await fetch(base+'/api/admin/upload',{method:'POST',headers,body:'<svg><script>alert(1)</script></svg>'})).status,400);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFz0AAAAASUVORK5CYII=','base64');
 response=await fetch(base+'/api/admin/upload',{method:'POST',headers,body:png});assert.equal(response.status,201);const upload=await response.json();response=await fetch(base+upload.url);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);
 assert.equal((await fetch(base+'/api/admin/logout',{method:'POST',headers})).status,200);
 assert.equal((await fetch(base+'/api/admin/content',{method:'PUT',headers,body:'{}'})).status,401);
 await stop();await start();assert.equal((await(await fetch(base+'/api/content')).json()).fields['text-0'],'Second headline');assert.equal((await fetch(base+upload.url)).status,200);
 }finally{await stop();await rm(directory,{recursive:true,force:true});}
});
