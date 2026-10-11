// Ported from the user-supplied Schema-on-Read Observatory.
// Original geometry and animation; no source renderer, camera, floor, background, DOM HUD, or controls.
import * as THREE from 'three';
export function createObservatoryScene() {
const scene=new THREE.Group();scene.name='observatory:elements';
const TAU=Math.PI*2;
const PHASES=[
  {node:'ingest',k:'INGESTION',t:'Capture incoming files and source metadata',detail:'Receive a scanned invoice or document; retain the original and its source ID.'},
  {node:'ocr',k:'OCR',t:'Extract text and layout from the document',detail:'Read text, tables, and page coordinates; retain confidence scores for review.'},
  {node:'classify',k:'CLASSIFICATION',t:'Identify the document type and processing rules',detail:'Classify the document as an invoice and choose its approved extraction schema.'},
  {node:'route',k:'ROUTING / ORCHESTRATION',t:'Choose the workflow and coordinate processing',detail:'Route the classified document to its extraction workflow; track attempts, retries, and failures.'},
  {node:'facts',k:'FACT FINDING',t:'Extract facts and resolve related entities',detail:'Find supplier, invoice number, dates, and totals. Use relationship parsing and lookup to resolve supplier references.'},
  {node:'evidence',k:'EVIDENCE & CONFIDENCE',t:'Link extracted facts to evidence and score certainty',detail:'Attach page locations and source excerpts to facts; flag uncertain values for human review.'},
  {node:'normalize',k:'NORMALIZATION',t:'Convert extracted facts into canonical values',detail:'Normalize dates, currencies, numbers, and field aliases while preserving source evidence.'},
  {node:'validation',k:'VALIDATION',t:'Check required fields, types, and business rules',detail:'Validate the schema and totals; flag missing references and low-confidence facts.'},
  {node:'vectorize',k:'VECTOR PROCESSING',t:'Chunk the processed submission and create embeddings',detail:'Split validated content into traceable chunks, embed each chunk, and store vectors with submission ID, version, source evidence, and access scope. Example embedding: [0.12, −0.48, 0.07, …] (illustrative).'},
  {node:'retrieval',writes:false,k:'RAG RETRIEVAL',t:'Retrieve relevant chunks as grounded generation context',detail:'Embed the context query, search the vector store within the submission’s access scope and current version, and return relevant chunks with source citations through the API for UI generation. Retrieval reads existing vectors and returns context; it does not write to the document database.'},
  {node:'uiGeneration',k:'UI GENERATION',t:'Build a review interface from validated facts',detail:'Generate an editable review UI from validated facts and retrieved context, with source citations and validation flags.'},
  {node:'human',k:'HUMAN REVIEW',t:'Correct uncertain facts and rerun normalization and validation',detail:'Receive the generated UI through API Server 01 into the web client. Reject uncertain values, send corrections through Normalization → Validation → UI Generation, and receive the revised UI back through the API and web client. Save review notes, corrections, and status.'},
  {node:'approval',k:'APPROVAL / DECISION',t:'Record approval, rejection, or a request for corrections',detail:'A separate decision records the reviewer, timestamp, and outcome. This mock example approves the reviewed document.'},
  {node:'export',k:'EXPORT / INTEGRATION',t:'Deliver approved data to downstream systems',detail:'Export the approved record to an ERP or API and store delivery status and destination. This is an animated mock delivery.'},
];
const STAGE=7;
const HUMAN_STAGE=PHASES.findIndex(stage=>stage.node==='human');
const FACT_STAGE=PHASES.findIndex(stage=>stage.node==='facts');
const REVIEW_DURATION=16;
const LOOP=PHASES.length*STAGE+REVIEW_DURATION-STAGE;
const stageDuration=i=>i===HUMAN_STAGE?REVIEW_DURATION:STAGE;
const stageStart=i=>i*STAGE+(i>HUMAN_STAGE?REVIEW_DURATION-STAGE:0);
const VECTOR_STAGE=PHASES.findIndex(stage=>stage.node==='vectorize');
const RETRIEVAL_STAGE=PHASES.findIndex(stage=>stage.node==='retrieval');
const persists=stage=>stage.writes!==false;
const persistenceStages=PHASES.filter(persists);
const completedWrites=stage=>PHASES.slice(0,stage).filter(persists).length;
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const ss=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const lerp=(a,b,t)=>a+(b-a)*t;
const eo=t=>1-Math.pow(1-clamp(t),3);
const eio=t=>{t=clamp(t);return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;};
const bump=(x,c,w)=>Math.exp(-(((x-c)/w)**2));
let seed=11; const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};

/* glow texture */
const glowTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
  const gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.18,'rgba(255,255,255,.65)');
  gr.addColorStop(.45,'rgba(255,255,255,.14)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);
  return new THREE.CanvasTexture(c);})();
const mkGlow=(color,s,op=1)=>{const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color,transparent:true,opacity:op,
  blending:THREE.AdditiveBlending,depthWrite:false}));sp.scale.setScalar(s);return sp;};

/* ---------- document grid dimensions (no floor or platform) ---------- */
const COLS=16,ROWS=12,N=COLS*ROWS,SP=1.15;
const PW=COLS*SP+1.2,PD=ROWS*SP+1.2;
/* radar rings */
const rings=[];
[[13.5,0x39e6ff,.5,1],[15,0xb46bff,.35,-1],[16.6,0x39e6ff,.18,1]].forEach(([r,c,o,dir],k)=>{
  const pts=[];for(let i=0;i<=256;i++){const a=i/256*TAU;pts.push(new THREE.Vector3(Math.cos(a)*r,0,Math.sin(a)*r));}
  const g=new THREE.BufferGeometry().setFromPoints(pts);
  const line=new THREE.Line(g,new THREE.LineDashedMaterial({color:c,dashSize:k==1?.25:1.2,gapSize:k==1?.5:.6,transparent:true,opacity:o}));
  line.computeLineDistances();line.position.y=-.2;line.userData.dir=dir;scene.add(line);rings.push(line);
  // ticks
  if(k==0){const tp=[];for(let i=0;i<72;i++){const a=i/72*TAU,l=i%6==0?1.1:.45;tp.push(new THREE.Vector3(Math.cos(a)*r,0,Math.sin(a)*r),new THREE.Vector3(Math.cos(a)*(r+l),0,Math.sin(a)*(r+l)));}
    const tk=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(tp),new THREE.LineBasicMaterial({color:c,transparent:true,opacity:.45}));
    tk.position.y=-.2;tk.userData.dir=dir;scene.add(tk);rings.push(tk);}
});

/* ---------- document cells ---------- */
const VCOL=[null,new THREE.Color(0xffb547),new THREE.Color(0xa46bff),new THREE.Color(0x39e6ff)];
const NEUTRAL=new THREE.Color(0x1d2a48), HOT=new THREE.Color(0x7ff6ff), WHITE=new THREE.Color(0xffffff), RED=new THREE.Color(0xff3355);
const cells=[];
for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
  const v=rnd()<.38?1:rnd()<.52?2:3;
  const price=Math.round(20+Math.pow(rnd(),1.15)*380);
  const cr=rnd(); const color=cr<.36?'blue':cr<.6?'red':cr<.8?'green':'black';
  const gx=(c-(COLS-1)/2)*SP, gz=(r-(ROWS-1)/2)*SP;
  cells.push({gx,gz,v,price,color,match:price>=150&&color==='blue',bad:rnd()<.035,
    ang:rnd()*TAU,rad:10+rnd()*14,yy:-1+rnd()*11,k:rnd()<.5?1:2,ph:rnd()*TAU,rk:1+Math.floor(rnd()*3),
    delay:(Math.hypot(gx,gz)/12)*1.2+rnd()*.35,dist:Math.hypot(gx,gz)});
}
const MATCHES=cells.filter(c=>c.match).length;
const boxG=new THREE.BoxGeometry(.84,1,.84); boxG.translate(0,.5,0);
const cellMat=new THREE.MeshStandardMaterial({color:0xffffff,metalness:.45,roughness:.38});
cellMat.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',
  '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * 0.30;');};
const cellMesh=new THREE.InstancedMesh(boxG,cellMat,N);
cellMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
for(let i=0;i<N;i++)cellMesh.setColorAt(i,NEUTRAL);
scene.add(cellMesh);
// wire caps on top of cells
const capMesh=new THREE.InstancedMesh(new THREE.EdgesGeometry(boxG).isBufferGeometry?boxG:boxG,
  new THREE.MeshBasicMaterial({color:0x9fefff,wireframe:true,transparent:true,opacity:.09,blending:THREE.AdditiveBlending,depthWrite:false}),N);
scene.add(capMesh);

/* ---------- inflow vortex particles ---------- */
const NP=1600;
const pg=new THREE.BufferGeometry();
{const off=new Float32Array(NP),ang=new Float32Array(NP),yy=new Float32Array(NP),pos=new Float32Array(NP*3),hue=new Float32Array(NP);
 for(let i=0;i<NP;i++){off[i]=rnd();ang[i]=rnd()*TAU;yy[i]=-1+rnd()*12;hue[i]=rnd();}
 pg.setAttribute('position',new THREE.BufferAttribute(pos,3));pg.setAttribute('aOff',new THREE.BufferAttribute(off,1));
 pg.setAttribute('aAng',new THREE.BufferAttribute(ang,1));pg.setAttribute('aY',new THREE.BufferAttribute(yy,1));pg.setAttribute('aH',new THREE.BufferAttribute(hue,1));}
const pMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  uniforms:{uT:{value:0},uI:{value:1},uPR:{value:Math.min(globalThis.devicePixelRatio || 1, 1.5)}},
  vertexShader:`attribute float aOff,aAng,aY,aH;uniform float uT,uI,uPR;varying float vA;varying float vH;
    void main(){float f=fract(uT/15.*3.+aOff);float r=mix(26.,1.5,f*f*(3.-2.*f));float a=aAng+f*6.2831*1.35;
      vec3 p=vec3(cos(a)*r,mix(aY,.6,f),sin(a)*r);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
      gl_PointSize=(1.6+2.6*f)*uPR*(28./-mv.z);vA=uI*sin(f*3.14159);vH=aH;}`,
  fragmentShader:`varying float vA;varying float vH;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d);
    vec3 c=mix(vec3(.35,.85,1.),vec3(.7,.45,1.),step(.72,vH));c=mix(c,vec3(1.,.72,.3),step(.9,vH));gl_FragColor=vec4(c*a*vA,a*vA);}`});
const vortex=new THREE.Points(pg,pMat); vortex.frustumCulled=false; scene.add(vortex);

/* ---------- pipeline nodes ---------- */
const NODES={
  ingest:{p:new THREE.Vector3(-12,5,8),c:0x39e6ff,name:'DATA INGESTION',sub:'API / events · raw JSON documents'},
  ocr:{p:new THREE.Vector3(-4,5,8),c:0x39e6ff,name:'OCR',sub:'text · layout · confidence'},
  classify:{p:new THREE.Vector3(4,5,8),c:0xb46bff,name:'CLASSIFICATION',sub:'document type · extraction schema'},
  facts:{p:new THREE.Vector3(12,5,8),c:0xffb547,name:'FACT FINDING',sub:'facts · evidence · entity lookup'},
  normalize:{p:new THREE.Vector3(12,5,-5),c:0xb46bff,name:'NORMALIZATION',sub:'canonical fields · dates · units'},
  validation:{p:new THREE.Vector3(4,5,-5),c:0x34ffc8,name:'VALIDATION',sub:'schema · confidence · business rules'},
  uiGeneration:{p:new THREE.Vector3(-4,5,-5),c:0x39e6ff,name:'UI GENERATION',sub:'values · evidence · review flags'},
  human:{p:new THREE.Vector3(-12,5,-5),c:0x34ffc8,name:'HUMAN REVIEW',sub:'inspect · correct · approve'},
  route:{p:new THREE.Vector3(),c:0x39e6ff,name:'ROUTING / ORCHESTRATION',sub:'workflow · retries · failures'},
  evidence:{p:new THREE.Vector3(),c:0xffb547,name:'EVIDENCE & CONFIDENCE',sub:'source anchors · uncertainty'},
  approval:{p:new THREE.Vector3(),c:0x34ffc8,name:'APPROVAL / DECISION',sub:'approve · reject · return'},
  export:{p:new THREE.Vector3(),c:0x39e6ff,name:'EXPORT / INTEGRATION',sub:'ERP / API · delivery status'},
  ui:  {p:new THREE.Vector3(-15.5,6.5,-1.5),c:0x39e6ff,name:'FILTER BUILDER',sub:'frontend · JSON query map'},
  comp:{p:new THREE.Vector3(-8,9.2,-8),c:0x7c8cff,name:'QUERY COMPILER',sub:'knex · parameterised whereRaw'},
  reg: {p:new THREE.Vector3(5,10.6,-12.5),c:0xb46bff,name:'SCHEMA REGISTRY',sub:'redis · approved field types'},
  rel: {p:new THREE.Vector3(-3,11,-8),c:0xb46bff,name:'RELATIONSHIP PARSER',sub:'approved paths · cardinality · join plan'},
  look:{p:new THREE.Vector3(8,6,-3),c:0xffb547,name:'LOOKUP RESOLVER',sub:'typed references · related entities'},
  vectorize:{p:new THREE.Vector3(),c:0xb46bff,name:'VECTOR PROCESSING',sub:'chunks · embeddings · versioned metadata'},
  retrieval:{p:new THREE.Vector3(),c:0x39e6ff,name:'RAG RETRIEVAL',sub:'scoped search · grounded context · citations'},
  vectorStore:{p:new THREE.Vector3(5,8,-3),c:0xb46bff,name:'VECTOR STORE',sub:'submission chunks · embeddings · provenance'},
  apiA:{p:new THREE.Vector3(-3,13,0),c:0x39e6ff,name:'API SERVER 01',sub:'HTTPS · query / document API'},
  apiB:{p:new THREE.Vector3(3,13,0),c:0x39e6ff,name:'API SERVER 02',sub:'HTTPS · query / document API'},
  clientWeb:{p:new THREE.Vector3(-7,19,0),c:0xb46bff,name:'WEB CLIENT',sub:'connected · review UI'},
  clientMobile:{p:new THREE.Vector3(0,20,0),c:0xb46bff,name:'MOBILE CLIENT',sub:'connected · document capture'},
  clientService:{p:new THREE.Vector3(7,19,0),c:0xffb547,name:'INTEGRATION CLIENT',sub:'connected · downstream service'},
  db:  {p:new THREE.Vector3(0,7.8,0),c:0x34ffc8,name:'POSTGRES · JSONB',sub:'schema v0 · awaiting stage updates'},
};
const INPUT_SOURCES=[
  {node:'sourceExcel',format:'XLSX',name:'EXCEL UPLOAD',origin:'Excel upload',extension:'xlsx',color:0x34ffc8},
  {node:'sourceDocx',format:'DOCX',name:'WORD DOCUMENT',origin:'DOCX upload',extension:'docx',color:0x39e6ff},
  {node:'sourceEmail',format:'EMAIL',name:'EMAIL INBOX',origin:'Inbound email',extension:'eml',color:0xffb547},
  {node:'sourceWebhook',format:'WEBHOOK',name:'WEBHOOK EVENT',origin:'Webhook / JSON event',extension:'json',color:0xb46bff},
  {node:'sourcePdf',format:'PDF',name:'PDF DOCUMENT',origin:'PDF document upload',extension:'pdf',color:0xff4d6d},
  {node:'sourceScan',format:'IMAGE',name:'SCAN / PHOTO',origin:'Scanned document or camera photo',extension:'png',color:0xffb547},
  {node:'sourceCsv',format:'CSV',name:'CSV IMPORT',origin:'CSV / tabular import',extension:'csv',color:0x34ffc8},
  {node:'sourceXml',format:'XML',name:'XML FEED',origin:'XML / structured feed',extension:'xml',color:0x39e6ff},
  {node:'sourceForm',format:'FORM',name:'WEB FORM',origin:'Web form submission',extension:'json',color:0xb46bff},
  {node:'sourceCloud',format:'CLOUD FILE',name:'CLOUD STORAGE',origin:'Cloud drive / object storage',extension:'pdf',color:0x39e6ff},
  {node:'sourceSftp',format:'SFTP',name:'SFTP DROP',origin:'SFTP batch file drop',extension:'csv',color:0xffb547},
  {node:'sourceDatabase',format:'DB EXPORT',name:'DATABASE EXPORT',origin:'Database snapshot / change record',extension:'json',color:0x34ffc8},
  {node:'sourceStream',format:'EVENT',name:'EVENT STREAM',origin:'Message queue / event stream',extension:'json',color:0xb46bff},
  {node:'sourceChat',format:'CHAT',name:'CHAT MESSAGE',origin:'Chat message / collaboration channel',extension:'txt',color:0x39e6ff},
];
INPUT_SOURCES.forEach((source,i)=>{
  const angle=Math.PI*.75+i/INPUT_SOURCES.length*TAU;
  NODES[source.node]={p:new THREE.Vector3(Math.cos(angle)*28,4.5,Math.sin(angle)*28),c:source.color,name:source.name,sub:source.format+' · external source'};
});
// Space the processing nodes evenly; client-side Human Review occupies no ring slot.
const processRing=PHASES.filter(stage=>!['human','retrieval'].includes(stage.node));
const ringRadius=14.5;
processRing.forEach((stage,i)=>{
  const angle=Math.PI*.75-i/processRing.length*TAU;
  NODES[stage.node].p.set(Math.cos(angle)*ringRadius,4.5,Math.sin(angle)*ringRadius);
});
// Human review runs in the client tier beside the connected review UI.
NODES.human.p.set(-10,19,4);
NODES.retrieval.p.set(0,15,-5);
NODES.retrieval.sub='API operation · vector search · read-only';
NODES.human.sub='client-side review · reject / retry / confirm';
const wireM=c=>new THREE.MeshBasicMaterial({color:c,wireframe:true,transparent:true,opacity:.6,blending:THREE.AdditiveBlending,depthWrite:false});
function buildNode(key){
  const d=NODES[key],g=new THREE.Group();g.position.copy(d.p);
  let body;
  if(key==='ui'||key.startsWith('client')||key.startsWith('source')){body=new THREE.Group();const s=new THREE.Mesh(new THREE.BoxGeometry(2.6,1.7,.12,6,4,1),wireM(d.c));body.add(s);
    for(let i=0;i<4;i++){const b=new THREE.Mesh(new THREE.PlaneGeometry(1.8*(1-i*.15),.16),new THREE.MeshBasicMaterial({color:d.c,transparent:true,opacity:.5,side:2}));b.position.set(-.1,.5-i*.32,.08);body.add(b);}}
  else if(key.startsWith('api')){body=new THREE.Group();for(let i=0;i<3;i++){const rack=new THREE.Mesh(new THREE.BoxGeometry(2.2,.48,1),wireM(d.c));rack.position.y=(i-1)*.65;body.add(rack);const light=mkGlow(0x34ffc8,.3,.8);light.position.set(.75,(i-1)*.65,.55);body.add(light);}}
  else if(key==='ingest'){body=new THREE.Mesh(new THREE.ConeGeometry(1.5,2.4,6,1,true),wireM(d.c));body.rotation.z=Math.PI;}
  else if(PHASES.some(stage=>stage.node===key)){body=new THREE.Mesh(key==='human'?new THREE.IcosahedronGeometry(1.1,1):new THREE.OctahedronGeometry(1.15,0),wireM(d.c));}
  else if(key==='comp'||key==='rel'){body=new THREE.Mesh(new THREE.OctahedronGeometry(1.25,1),wireM(d.c));}
  else if(key==='reg'){body=new THREE.Mesh(new THREE.IcosahedronGeometry(1.3,1),wireM(d.c));}
  else {body=new THREE.Group();for(let i=0;i<3;i++){const cy=new THREE.Mesh(new THREE.CylinderGeometry(1.25,1.25,.42,32,1,true),wireM(d.c));cy.position.y=(i-1)*.62;body.add(cy);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(1.25,.025,6,64),new THREE.MeshBasicMaterial({color:d.c}));rim.rotation.x=Math.PI/2;rim.position.y=(i-1)*.62+.21;body.add(rim);}}
  g.add(body);
  const core=new THREE.Mesh(new THREE.IcosahedronGeometry(.26,2),new THREE.MeshBasicMaterial({color:0xffffff}));g.add(core);
  const glow=mkGlow(d.c,5,.7);g.add(glow);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(2,.012,6,128),new THREE.MeshBasicMaterial({color:d.c,transparent:true,opacity:.55}));ring.rotation.x=Math.PI/2.3;g.add(ring);
  const ring2=new THREE.Mesh(new THREE.TorusGeometry(2.35,.008,6,128),new THREE.MeshBasicMaterial({color:d.c,transparent:true,opacity:.3}));ring2.rotation.y=Math.PI/2.6;g.add(ring2);
  scene.add(g);
  Object.assign(d,{g,body,core,glow,ring,ring2});
}
Object.keys(NODES).forEach(buildNode);
const infrastructureNodes=new Set([...INPUT_SOURCES.map(source=>source.node),'vectorStore','apiA','apiB','clientWeb','clientMobile','clientService']);
const workflowNodes=new Set(PHASES.map(stage=>stage.node));
Object.entries(NODES).forEach(([key,node])=>{if(!workflowNodes.has(key)){node.g.scale.setScalar(key==='db'?1:infrastructureNodes.has(key)?.7:.45);node.g.visible=true;}});

// Keep the original node titles and descriptions in the native world scene.
// Sprites face the player's camera without depending on the source DOM HUD.
Object.entries(NODES).forEach(([key,node])=>{
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=192;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='rgba(8,18,32,0.92)';ctx.fillRect(0,0,1024,192);
  ctx.fillStyle='#'+new THREE.Color(node.c).getHexString();ctx.fillRect(0,0,1024,6);
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='600 44px sans-serif';ctx.fillText(node.name,512,69,960);
  ctx.fillStyle='#dae7f2';ctx.font='30px sans-serif';ctx.fillText(node.sub,512,133,960);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}));
  label.name='observatory:label:'+key;
  label.userData.title=node.name;label.userData.description=node.sub;
  // Counter the smaller infrastructure geometry scale to keep all text legible.
  const scale=node.g.scale.x;
  label.scale.set(6/scale,1.125/scale,1);
  label.position.y=2.7+0.5625/scale;
  node.g.add(label);
});

/* connections */
const arc=(a,b,lift)=>{const m=a.clone().add(b).multiplyScalar(.5);m.y+=lift;return new THREE.QuadraticBezierCurve3(a.clone(),m,b.clone());};
// Client-side review traffic crosses the web client and API boundary.
function processRoute(source,target,lift=1.2){
  const keys=source==='human'?['human','clientWeb','apiA',target]:target==='human'?[source,'apiA','clientWeb','human']:source==='retrieval'||target==='retrieval'?[source,'apiA',target]:[source,target];
  const path=new THREE.CurvePath();
  keys.slice(0,-1).forEach((key,i)=>path.add(arc(NODES[key].p,NODES[keys[i+1]].p,lift)));
  path.routeKeys=keys;
  return path;
}
function routeDestination(path,u){
  const lengths=path.getCurveLengths();
  const distance=clamp(u)*lengths[lengths.length-1];
  const hop=lengths.findIndex(length=>distance<=length);
  return path.routeKeys[Math.max(0,hop)+1];
}
const CUR={
  source:arc(NODES.ingest.p,NODES.db.p,2),
  validate:arc(NODES.db.p,NODES.reg.p,1.2),
  uc:arc(NODES.ui.p,NODES.comp.p,3),
  cr:arc(NODES.comp.p,NODES.reg.p,2.6),
  cd:arc(NODES.look.p,NODES.db.p,2),
  rp:arc(NODES.comp.p,NODES.rel.p,1),
  pl:arc(NODES.rel.p,NODES.look.p,1.5),
  rc:arc(NODES.reg.p,NODES.comp.p,2.6),
  rd:arc(NODES.reg.p,NODES.db.p,1.2),
};
PHASES.slice(0,-1).forEach((stage,i)=>{
  CUR['flow'+i]=processRoute(stage.node,PHASES[i+1].node);
});
PHASES.forEach((stage,i)=>{if(persists(stage))CUR['write'+i]=processRoute(stage.node,'db',2);});
const CORRECTION_PATH=['human','normalize','validation','vectorize','retrieval','uiGeneration','human'];
CORRECTION_PATH.slice(0,-1).forEach((key,i)=>{CUR['correct'+i]=processRoute(key,CORRECTION_PATH[i+1],1.2);});
CUR.ragIndex=arc(NODES.vectorize.p,NODES.vectorStore.p,1.5);
CUR.ragQuery=arc(NODES.retrieval.p,NODES.vectorStore.p,1.2);
CUR.ragContext=arc(NODES.vectorStore.p,NODES.retrieval.p,2);
const ragPacket=mkGlow(0xb46bff,1.5,0);scene.add(ragPacket);
const correctionPacket=mkGlow(0xb46bff,2,0);scene.add(correctionPacket);
const API_LINKS=[['clientWeb','human'],['clientWeb','apiA'],['clientMobile','apiA'],['clientMobile','apiB'],['clientService','apiB'],['apiA','db'],['apiB','db']];
API_LINKS.forEach(([source,target],i)=>{CUR['apiLink'+i]=arc(NODES[source].p,NODES[target].p,.5);});
INPUT_SOURCES.forEach((source,i)=>{CUR['ingress'+i]=arc(NODES[source.node].p,NODES.ingest.p,2);});
const incomingPacket=new THREE.Mesh(new THREE.BoxGeometry(.6,.8,.12),new THREE.MeshBasicMaterial({color:0x34ffc8}));scene.add(incomingPacket);
const incomingGlow=mkGlow(0x34ffc8,2.2,0);scene.add(incomingGlow);
const ingressTrail=Array.from({length:12},(_,i)=>{const sprite=mkGlow(0x34ffc8,.85*(1-i/14),0);scene.add(sprite);return sprite;});
const tubes={};
Object.entries(CUR).forEach(([k,c])=>{
  const m=new THREE.Mesh(new THREE.TubeGeometry(c,80,k==='rd'?.025:.04,6,false),
    new THREE.MeshBasicMaterial({color:k==='rd'||k.startsWith('correct')?0xb46bff:0x5fd8ff,transparent:true,opacity:.28,blending:THREE.AdditiveBlending,depthWrite:false}));
  scene.add(m);tubes[k]=m;
});
// ambient pulses
const pulses=[];
Object.entries(CUR).forEach(([k,c])=>{for(let i=0;i<5;i++){const s=mkGlow(k==='rd'?0xb46bff:0x7feaff,.7,.8);scene.add(s);pulses.push({s,c,k,i});}});
// Each processing stage writes its own result to the central database.
const writePacket=mkGlow(0x34ffc8,1.7,0);scene.add(writePacket);
const writeTrail=Array.from({length:10},(_,i)=>{const sprite=mkGlow(0x34ffc8,.9*(1-i/12),0);scene.add(sprite);return sprite;});
const schemaLayers=persistenceStages.map((stage,i)=>{
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.5+i*.13,.035,8,64),new THREE.MeshBasicMaterial({color:NODES[stage.node].c,transparent:true,opacity:0}));
  ring.rotation.x=Math.PI/2;ring.position.y=(i-3.5)*.24;NODES.db.g.add(ring);return ring;
});
// query packet + trail
const packet=mkGlow(0xffffff,2.6,1);scene.add(packet);
const packetCore=mkGlow(0x39e6ff,5,1);scene.add(packetCore);
const trail=[];for(let i=0;i<14;i++){const s=mkGlow(0x39e6ff,1.6*(1-i/16),1);scene.add(s);trail.push(s);}
// DB → grid light beam
const beamMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
  uniforms:{uA:{value:0},uT:{value:0}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec2 vUv;uniform float uA,uT;void main(){float s=.6+.4*sin(vUv.y*40.-uT*30.);
    float a=uA*(1.-abs(vUv.x-.5)*2.)*.0+uA*pow(1.-vUv.y,.5)*s;gl_FragColor=vec4(vec3(.4,1.,.95)*a,a);}`});
const beam=new THREE.Mesh(new THREE.CylinderGeometry(.25,7,7.2,48,1,true),beamMat);beam.position.set(0,3.9,0);scene.add(beam);

function schemaState(t){
  const stage=PHASES.findIndex((_,i)=>t<stageStart(i)+stageDuration(i));
  const progress=clamp((t-stageStart(stage))/stageDuration(stage));
  return {stage,progress,version:completedWrites(stage)+(persists(PHASES[stage])&&progress>=.8?1:0)};
}

function packetAt(t){
  const {stage,progress}=schemaState(t);
  if(stage===PHASES.length-1)return null;
  // Review owns the packet until its retry completes; only then proceed to decision.
  if(stage===HUMAN_STAGE&&progress<.9)return null;
  const u=stage===HUMAN_STAGE?clamp((progress-.9)/.1):clamp((progress-.6)/.4);
  return [CUR['flow'+stage],eio(u),1];
}


const dummy=new THREE.Object3D(),col=new THREE.Color(),tmp=new THREE.Color();
const INGRESS_INTERVAL=20,INGRESS_DURATION=2.4;
cellMesh.name='observatory:document-cells';capMesh.name='observatory:document-caps';
vortex.name='observatory:inflow';beam.name='observatory:database-beam';
Object.entries(NODES).forEach(([key,node])=>node.g.name='observatory:node:'+key);
Object.entries(tubes).forEach(([key,tube])=>tube.name='observatory:connection:'+key);
scene.userData.nodeKeys=Object.keys(NODES);
scene.userData.stageNames=PHASES.map(stage=>stage.k);
scene.userData.update=(elapsed)=>{
  const ms=elapsed*1000;
  const arrivalIndex=Math.floor(elapsed/INGRESS_INTERVAL);
  const incomingSubmission={source:INPUT_SOURCES[arrivalIndex%INPUT_SOURCES.length]};
  const incomingSource=incomingSubmission.source;
  const ingressAge=elapsed-arrivalIndex*INGRESS_INTERVAL;
  const ingressActive=ingressAge<INGRESS_DURATION;
  const ingressU=eio(clamp(ingressAge/INGRESS_DURATION));
  const ingressCurve=CUR['ingress'+arrivalIndex%INPUT_SOURCES.length];
  incomingPacket.position.copy(ingressCurve.getPoint(ingressU));
  incomingPacket.rotation.set(.1,.3+elapsed*.6,0);
  incomingPacket.visible=ingressActive;
  incomingPacket.material.color.setHex(incomingSource.color);
  incomingGlow.position.copy(incomingPacket.position);incomingGlow.material.color.setHex(incomingSource.color);incomingGlow.material.opacity=ingressActive?.8:0;
  ingressTrail.forEach((sprite,i)=>{sprite.position.copy(ingressCurve.getPoint(clamp(ingressU-(i+1)*.025)));sprite.material.color.setHex(incomingSource.color);sprite.material.opacity=ingressActive?.6*(1-i/12):0;});
  INPUT_SOURCES.forEach((source,i)=>{tubes['ingress'+i].material.opacity=ingressActive&&i===arrivalIndex%INPUT_SOURCES.length?.8:.08;});
  const t=((ms/1000)%LOOP+LOOP)%LOOP, w=TAU*t/LOOP;
  const phase=Math.min(4,Math.floor(t/3));
  const receipt=schemaState(t);
  const processPhase=receipt.stage;
  const humanWrite=processPhase===HUMAN_STAGE;
  // Send three visible review updates: notes, corrections, then review status.
  const reviewLeg=Math.min(2,Math.floor(clamp((receipt.progress-.05)/.75)*3));
  const writeProgress=humanWrite?clamp((receipt.progress-(.05+reviewLeg*.25))/.25):clamp((receipt.progress-.2)/.6);
  const stageWrites=persists(PHASES[processPhase]);
  const receiving=stageWrites&&(humanWrite?(receipt.progress>=.05&&receipt.progress<.8):(receipt.progress>=.2&&receipt.progress<.8));
  const arrival=stageWrites?(humanWrite?Math.max(...[.3,.55,.8].map(at=>bump(receipt.progress,at,.045))):bump(receipt.progress,.8,.08)):0;

  /* phase envelopes */
  const assembleOut=s=>ss(13.25+s*.45,14.25+s*.45,t);
  const bar=ss(7.85,8.7,t)*(1-ss(12.5,13.4,t));
  const sel=ss(8.3,8.9,t)*(1-ss(9.15,9.7,t));
  const sx=lerp(-13,13,clamp((t-3.15)/2.4));
  const R=(t-9.3)*7.2, evoWin=ss(9.2,9.5,t)*(1-ss(11.8,12.4,t));
  const convert=ss(9.3,11.8,t)*(1-ss(13.9,14.8,t));
  const neutralBack=ss(13.6,14.7,t);
  const isz=lerp(-9,9,clamp((t-12.4)/1.6)), idxWin=ss(12.3,12.5,t)*(1-ss(13.9,14.3,t));

  /* cells */
  for(let i=0;i<N;i++){const c=cells[i];
    const aIn=eo((t-.35-c.delay)/1.25), aOut=assembleOut(c.delay/1.55);
    const as=aIn*(1-aOut);
    const a=c.ang+w*c.k, rr=c.rad+1.6*Math.sin(w*2+c.ph);
    const scx=Math.cos(a)*rr, scz=Math.sin(a)*rr, scy=c.yy+1.2*Math.sin(w*3+c.ph);
    const swoop=Math.sin(Math.PI*as)*2.6;
    // heights
    let h=.16+.04*Math.sin(w*6+c.ph)*as;
    const pricH=c.price/400*4.6;
    const evoBump=Math.exp(-((R-c.dist)**2)*.9)*evoWin;
    h+=bar*pricH*(c.match?1:lerp(1,.18,sel));
    h+=evoBump*(c.v===1?1.0:.35);
    const idxFlash=Math.exp(-((isz-c.gz)**2)*1.4)*idxWin;
    h+=idxFlash*.5;
    const sc=lerp(.5,1,as);
    dummy.position.set(lerp(scx,c.gx,as),lerp(scy,0,as)+swoop,lerp(scz,c.gz,as));
    const rot=(1-as)*(w*c.rk+c.ph);
    dummy.rotation.set(rot,rot*.7,rot*.3);
    dummy.scale.set(sc,lerp(.5,h,as),sc);
    dummy.updateMatrix();cellMesh.setMatrixAt(i,dummy.matrix);capMesh.setMatrixAt(i,dummy.matrix);
    // colour
    const rv=clamp((sx-c.gx)/1.4);
    const scanFlash=Math.exp(-((sx-c.gx)**2)*1.2)*(t>3&&t<5.9?1:0);
    let vcol=VCOL[c.v];
    if(c.v===1){const pass=clamp((R-c.dist)/1.4)*(t>9.2?1:0);tmp.copy(VCOL[1]).lerp(VCOL[2],pass);vcol=tmp;}
    col.copy(NEUTRAL).lerp(vcol,rv);
    // ingest shimmer for scattered docs
    if(as<1){col.lerp(c.v===1?VCOL[1]:c.v===2?VCOL[2]:VCOL[3],.35*(1-as)*(1-neutralBack*.5));}
    if(c.bad&&scanFlash>.05){col.lerp(RED,clamp(scanFlash*1.6));}
    else col.lerp(WHITE,scanFlash*.6);
    if(sel>0){if(c.match){col.lerp(HOT,sel*.7);col.multiplyScalar(1+sel*(.35+.25*Math.sin(t*14+c.ph)));}else col.multiplyScalar(lerp(1,.12,sel));}
    col.lerp(WHITE,evoBump*.28);
    col.lerp(HOT,idxFlash*.6);
    col.lerp(NEUTRAL,neutralBack*as*.85);
    cellMesh.setColorAt(i,col);
  }
  cellMesh.instanceMatrix.needsUpdate=true;cellMesh.instanceColor.needsUpdate=true;capMesh.instanceMatrix.needsUpdate=true;
  capMesh.material.opacity=.06+.12*sel;


  rings.forEach((r,k)=>{r.rotation.y=w*r.userData.dir*(k%2?1:2);});
  pMat.uniforms.uT.value=t;
  pMat.uniforms.uI.value=.18+.95*Math.max(1-ss(2.2,3.6,t),ss(13.2,14.8,t));
  /* nodes */
  const act={
    ingest:.35+.9*ss(.1,.4,t)*(1-ss(2.4,3,t)),
    ui:.35+bump(t,6.05,.25)*1.4+.4*ss(5.3,5.6,t)*(1-ss(6.2,6.5,t)),
    comp:.35+bump(t,6.7,.18)*1.3+bump(t,7.4,.2)*1.3+.3*bump(t,7.1,.6),
    reg:.35+.55*ss(3,3.4,t)*(1-ss(5.6,6,t))+bump(t,7.05,.18)*1.5,
    rel:.35+bump(t,7.45,.2)*1.4,
    look:.35+bump(t,7.7,.2)*1.4,
    db:.4+.4*Math.max(1-ss(2.5,3.4,t),ss(13.6,14.8,t))+bump(t,7.95,.22)*1.6,
  };
  PHASES.forEach((stage,i)=>{act[stage.node]=i===processPhase?1.6:.3;});
  act.db=.5+arrival*1.6;
  INPUT_SOURCES.forEach(source=>{act[source.node]=ingressActive&&source.node===incomingSource.node?1.2:.25;});
  if(ingressActive)act.ingest=Math.max(act.ingest,.8);
  Object.entries(NODES).forEach(([k,d],i)=>{
    const a=act[k]??.4;
    d.g.position.y=d.p.y+(k==='db'||infrastructureNodes.has(k)?0:Math.sin(w*2+i*1.7)*.25);
    d.body.rotation.y=infrastructureNodes.has(k)?0:w*(i%2?1:-1)*(k==='ui'?0:2)+(k==='ui'?Math.sin(w)*.3+.5:0);
    if(k!=='ui'&&k!=='db'&&!infrastructureNodes.has(k))d.body.rotation.x=w;
    d.ring.rotation.z=w*3;d.ring2.rotation.x=-w*2;
    d.glow.scale.setScalar(3.5+a*3.2);d.glow.material.opacity=.35+a*.45;
    d.core.scale.setScalar(.8+a*.9);
    d.ring.scale.setScalar(1+bump(a,1.8,.6)*.3);
  });
  const writeCurve=CUR['write'+processPhase];
  if(writeCurve)writePacket.position.copy(writeCurve.getPoint(eio(writeProgress)));
  writePacket.material.color.setHex(NODES[PHASES[processPhase].node].c);
  writePacket.material.opacity=receiving?1:0;
  writePacket.scale.setScalar(humanWrite?3:1.7);
  writeTrail.forEach((sprite,i)=>{
    if(writeCurve)sprite.position.copy(writeCurve.getPoint(clamp(eio(writeProgress)-(i+1)*.025)));
    sprite.material.color.copy(writePacket.material.color);
    sprite.material.opacity=receiving?.65*(1-i/10):0;
  });
  PHASES.forEach((stage,i)=>{if(!persists(stage))return;tubes['write'+i].material.opacity=i===processPhase?(humanWrite?.5+.5*(receiving?1:arrival):.2+.65*(receiving?1:arrival)):.06;});
  schemaLayers.forEach((ring,i)=>{ring.material.opacity=i<receipt.version?.65:0;ring.rotation.z=w*(i%2?1:-1);});
  const rejected=humanWrite&&receipt.progress<.15;
  const correctionActive=humanWrite&&receipt.progress>=.15&&receipt.progress<.75;
  const correctionSegments=CORRECTION_PATH.length-1;
  const correctionPosition=clamp((receipt.progress-.15)/.6)*correctionSegments;
  const correctionIndex=Math.min(correctionSegments-1,Math.floor(correctionPosition));
  correctionPacket.position.copy(CUR['correct'+correctionIndex].getPoint(eio(correctionPosition-correctionIndex)));
  correctionPacket.material.opacity=humanWrite&&receipt.progress<.9?1:0;
  correctionPacket.material.color.setHex(rejected?0xff4d6d:0xffb547);
  if(humanWrite&&!correctionActive)correctionPacket.position.copy(NODES.human.p);
  NODES.human.body.material.color.setHex(rejected?0xff4d6d:0x34ffc8);
  NODES.human.glow.material.color.setHex(rejected?0xff4d6d:0x34ffc8);
  CORRECTION_PATH.slice(0,-1).forEach((key,i)=>{tubes['correct'+i].material.opacity=correctionActive?(i===correctionIndex?.95:.3):.06;});
  if(correctionActive){const target=NODES[CORRECTION_PATH[correctionIndex+1]];target.glow.material.opacity=1;target.core.scale.setScalar(2);}
  const vectorPass=processPhase===VECTOR_STAGE||(correctionActive&&CORRECTION_PATH[correctionIndex+1]==='vectorize');
  const retrievalPass=processPhase===RETRIEVAL_STAGE||(correctionActive&&CORRECTION_PATH[correctionIndex+1]==='retrieval');
  const ragProgress=correctionActive?correctionPosition-correctionIndex:receipt.progress;
  const ragRoute=vectorPass?'ragIndex':ragProgress<.4?'ragQuery':'ragContext';
  const ragU=vectorPass?clamp((ragProgress-.2)/.6):ragProgress<.4?clamp(ragProgress/.4):clamp((ragProgress-.4)/.4);
  ragPacket.position.copy(CUR[ragRoute].getPoint(eio(ragU)));
  ragPacket.material.opacity=vectorPass||retrievalPass?1:0;
  ragPacket.material.color.setHex(vectorPass?0xb46bff:0x39e6ff);
  ['ragIndex','ragQuery','ragContext'].forEach(key=>{tubes[key].material.opacity=(vectorPass||retrievalPass)&&key===ragRoute?.8:.08;});
  NODES.vectorStore.glow.material.opacity=vectorPass||retrievalPass?.9:.25;
  // Highlight the active handoff between workflow nodes.
  PHASES.slice(0,-1).forEach((stage,i)=>{tubes['flow'+i].material.opacity=i===processPhase&&(!humanWrite||receipt.progress>=.9)?.9:.18;});
  // tubes intensity
  tubes.source.material.opacity=.15+.7*ss(.1,.4,t)*(1-ss(2.4,3,t));
  tubes.validate.material.opacity=.15+.7*(t>=3.1&&t<4.3?1:0);
  tubes.uc.material.opacity=.22+.6*(t>6&&t<6.8?1:0)*ss(6,6.1,t);
  tubes.cr.material.opacity=.22+.6*(t>6.65&&t<7.45?1:0);
  tubes.rp.material.opacity=.22+.6*(t>7.25&&t<7.45?1:0);
  tubes.pl.material.opacity=.22+.6*(t>7.45&&t<7.7?1:0);
  tubes.rc.material.opacity=.22+.6*(t>7.05&&t<7.25?1:0);
  tubes.cd.material.opacity=.22+.6*(t>7.7&&t<8.05?1:0);
  tubes.rd.material.opacity=.12+.45*ss(3,3.4,t)*(1-ss(5.6,6,t));
  pulses.forEach(p=>{const u=((w/TAU)*(p.k==='rd'?2:3)+p.i/5)%1;p.s.position.copy(p.c.getPoint(u));
    const boost=p.k==='rd'?ss(3,3.4,t)*(1-ss(5.6,6,t)):.4;p.s.material.opacity=Math.sin(Math.PI*u)*(.25+boost);});
  // query packet
  const pk=packetAt(t);
  if(pk){const[c,u,dir]=pk;packet.position.copy(c.getPoint(u));packetCore.position.copy(packet.position);
    packet.material.opacity=1;packetCore.material.opacity=.9;
    trail.forEach((s,i)=>{s.position.copy(c.getPoint(clamp(u-dir*(i+1)*.018)));s.material.opacity=.7*(1-i/14);});}
  else{packet.position.copy(NODES[humanWrite?'human':'export'].g.position);packetCore.position.copy(packet.position);packet.material.opacity=humanWrite?0:.8;packetCore.material.opacity=humanWrite?0:.8;trail.forEach(s=>s.material.opacity=0);}
  packetCore.scale.setScalar(4+Math.sin(t*30)*.6);
  beamMat.uniforms.uA.value=ss(7.85,8.0,t)*(1-ss(8.25,9,t))*1.1;beamMat.uniforms.uT.value=t;

};
scene.userData.update(0);
return scene;
}
