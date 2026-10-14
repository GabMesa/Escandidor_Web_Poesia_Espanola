import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fetchContest} from '../prototipo/importer.js';
import {localPlica,extractPdf,initializeLocalPlicas} from './prototype-services.mjs';
import {normalizePlica} from '../plica-policy.js';
import {randomUUID} from 'node:crypto';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const port=Number(process.env.PROTOTYPE_PORT)||8793;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.otf':'font/otf','.json':'application/json'};
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1:'+port);
    if(url.pathname==='/api/plicas'){
      const origin=req.headers.origin;if(origin&&!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(origin)){json(res,403,{error:'Origen no permitido.'});return;}
      let owner=req.headers.cookie?.match(/(?:^|;\s*)workshop_local=([\da-f-]{36})(?:;|$)/)?.[1];
      if(!owner){owner=randomUUID();res.setHeader('Set-Cookie',`workshop_local=${owner}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`);}
      try{
        if(req.method==='GET'){json(res,200,await localPlica({operation:'get',owner}));return;}
        if(req.method!=='PUT'){json(res,405,{error:'Método no permitido.'});return;}
        let body='';for await(const chunk of req){body+=chunk;if(body.length>32000){json(res,413,{error:'Datos demasiado grandes.'});return;}}
        const input=JSON.parse(body);json(res,200,await localPlica({operation:'put',owner,plica:normalizePlica(input.plica)}));
      }catch(e){json(res,400,{error:e.message});}return;
    }
    if(url.pathname==='/api/prototype/import'){
      if(req.method!=='POST'){json(res,405,{error:'Usá POST.'});return;}
      const origin=req.headers.origin;if(origin && ![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(origin)){json(res,403,{error:'Origen no permitido.'});return;}
      let body='';for await(const chunk of req){body+=chunk;if(body.length>8000){json(res,413,{error:'Solicitud demasiado grande.'});return;}}
      let input;try{input=JSON.parse(body);}catch{json(res,400,{error:'Solicitud inválida.'});return;}
      try{json(res,200,{ok:true,contest:await fetchContest(input.url,{extractPdf})});}catch(error){json(res,422,{error:error.name==='AbortError'?'La consulta demoró demasiado. Probá de nuevo o completá la ficha manualmente.':error.message});}return;
    }
    if(url.pathname.startsWith('/api/')){json(res,200,{ok:true,user:null,poems:[],donors:[],count:0});return;}
    if(req.method!=='GET'&&req.method!=='HEAD'){json(res,405,{error:'Método no permitido.'});return;}
    let pathname=decodeURIComponent(url.pathname);if(pathname==='/')pathname='/prototipo/index.html';else if(pathname.endsWith('/'))pathname+='index.html';
    const file=resolve(root,'.'+pathname);
    if(!file.startsWith(root+sep)||pathname.split('/').some(p=>p.startsWith('.')||['node_modules','functions','migrations','scripts','tests','workers'].includes(p))){res.writeHead(403);res.end('No disponible');return;}
    try{const data=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);}catch{res.writeHead(404);res.end('Archivo no encontrado');}
  } catch{json(res,500,{error:'No se pudo procesar la solicitud.'});}
});
await initializeLocalPlicas();
server.listen(port,'127.0.0.1',()=>console.log(`Prototipo local: http://127.0.0.1:${port}/prototipo/`));
