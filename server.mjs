import http from 'node:http';
import {readFile,writeFile,mkdir,rename,copyFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validate,defaults} from './validate.mjs';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
const root=fileURLToPath(new URL('./dist/',import.meta.url));
const dataDir=process.env.HALLI_DATA_DIR||fileURLToPath(new URL('./data/',import.meta.url));
const uploadDir=resolve(dataDir,'uploads');
await mkdir(uploadDir,{recursive:true});
const contentPath=resolve(dataDir,'content.json');
const passwordSalt=randomBytes(16);const passwordHash=scryptSync(process.env.HALLI_ADMIN_PASSWORD||randomBytes(24).toString('hex'),passwordSalt,32);
const sessions=new Map();const attempts=new Map();let saving=false;
const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml','.json':'application/json'};
function reply(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data));}
async function body(req,max=2_000_000){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>max){const e=Error('File is too large. Maximum image size is 10 MB.');e.status=413;throw e;}chunks.push(chunk);}return Buffer.concat(chunks);}
function session(req){const cookie=req.headers.cookie||'';const id=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('halli_session='))?.slice(14);const value=sessions.get(id);if(value&&value.expires>Date.now())return {id,...value};if(id)sessions.delete(id);return null;}
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const path=decodeURIComponent(url.pathname);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
if(req.method!=='GET'&&req.method!=='HEAD'&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){reply(res,403,{error:'Please make changes from the local website.'});return;}
if(path==='/api/content'&&req.method==='GET'){let content=defaults;try{content=JSON.parse(await readFile(contentPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}reply(res,200,content);return;}
if(path==='/api/admin/login'&&req.method==='POST'){const address=req.socket.remoteAddress;let attempt=attempts.get(address);if(!attempt||attempt.until<Date.now())attempt={count:0,until:Date.now()+60_000};if(attempt.count>=12){reply(res,429,{error:'Too many attempts. Please wait one minute.'});return;}attempt.count++;attempts.set(address,attempt);const input=JSON.parse(await body(req,1000));const candidate=typeof input.password==='string'&&input.password.length<=100?scryptSync(input.password,passwordSalt,32):Buffer.alloc(32);if(!timingSafeEqual(passwordHash,candidate)){reply(res,401,{error:'That password isn’t right. Please try again.'});return;}attempts.delete(address);const id=randomBytes(32).toString('hex');const csrf=randomBytes(32).toString('hex');sessions.set(id,{csrf,expires:Date.now()+12*60*60*1000});reply(res,200,{authenticated:true,csrf},{'Set-Cookie':`halli_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`});return;}
if(path==='/api/admin/session'&&req.method==='GET'){const auth=session(req);reply(res,200,{authenticated:Boolean(auth),...(auth?{csrf:auth.csrf}:{})});return;}
if(path.startsWith('/api/admin/')){const auth=session(req);if(!auth){reply(res,401,{error:'Please sign in again.'});return;}if(req.headers['x-csrf-token']!==auth.csrf){reply(res,403,{error:'Your session needs a refresh. Please reload the admin page.'});return;}
if(path==='/api/admin/logout'&&req.method==='POST'){sessions.delete(auth.id);reply(res,200,{ok:true},{'Set-Cookie':'halli_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});return;}
if(path==='/api/admin/content'&&req.method==='PUT'){const content=validate(JSON.parse(await body(req)));if(saving){reply(res,409,{error:'Another save is finishing. Please try again.'});return;}saving=true;try{try{await copyFile(contentPath,resolve(dataDir,'content.backup.json'));}catch(e){if(e.code!=='ENOENT')throw e;}const temp=resolve(dataDir,'content.tmp.json');await writeFile(temp,JSON.stringify(content,null,2));await rename(temp,contentPath);}finally{saving=false;}reply(res,200,{ok:true,savedAt:new Date().toISOString(),content});return;}
if(path==='/api/admin/upload'&&req.method==='POST'){const bytes=await body(req,10*1024*1024);let ext;if(bytes.length>12&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)ext='jpg';else if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))ext='png';else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')ext='webp';else if(/^GIF8[79]a$/.test(bytes.toString('ascii',0,6)))ext='gif';else{reply(res,400,{error:'Please use a JPG, PNG, WebP, or GIF image.'});return;}const filename=`${randomBytes(16).toString('hex')}.${ext}`;await writeFile(resolve(uploadDir,filename),bytes);reply(res,201,{url:`/uploads/${filename}`});return;}
reply(res,404,{error:'Not found'});return;}
if(!['GET','HEAD'].includes(req.method)){reply(res,405,{error:'Method not allowed'});return;}
let base=root;let relative=path==='/'?'/index.html':path==='/admin'||path==='/admin/'?'/admin.html':path;if(path.startsWith('/uploads/')){base=uploadDir;relative=path.slice('/uploads'.length);}
const file=resolve(base,'.'+relative);const boundary=base.endsWith(sep)?base:base+sep;if(!file.startsWith(boundary)){reply(res,403,{error:'Forbidden'});return;}const data=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache',...(path.startsWith('/admin')?{'X-Frame-Options':'DENY'}:{})});res.end(req.method==='HEAD'?undefined:data);
}catch(error){reply(res,error.code==='ENOENT'?404:error.status||400,{error:error.code==='ENOENT'?'Page not found':error.message||'Unable to process this request.'});}}).listen(port,'127.0.0.1',()=>console.log(`Halli website is running at http://localhost:${port}`));
