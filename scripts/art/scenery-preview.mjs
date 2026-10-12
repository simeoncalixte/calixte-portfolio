import fs from 'node:fs/promises';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {createAIShrine} from '../../src/world/aiShrine.js';
import {Walkable} from '../../src/world/walkable.js';
import {buildBridgeData} from '../../src/world/layout.js';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
const shrine=createAIShrine(new Walkable(buildBridgeData()));shrine.position.set(0,0,0);shrine.userData.update(3);
const out=await new GLTFExporter().parseAsync(shrine,{binary:true});await fs.writeFile('/tmp/ai-shrine.glb',Buffer.from(out));
