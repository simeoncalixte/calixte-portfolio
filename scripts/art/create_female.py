"""Sculpt a distinct female explorer in Blender; preserve source vertex/skin correspondence."""
import bpy,os,json,math,bmesh
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
parts=json.load(open(os.path.join(ROOT,'scripts/art/female-source.json')))
materials={};outputs=[]
def material(name,color):
 if name in materials:return materials[name]
 m=bpy.data.materials.new(name);m.diffuse_color=tuple(color);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=tuple(color);p.inputs['Roughness'].default_value=.75
 materials[name]=m;return m
def add(name,verts,indices,mat):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],[indices[i:i+3] for i in range(0,len(indices),3)]);mesh.update()
 ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob);mesh.materials.append(mat)
 for face in mesh.polygons:face.use_smooth=True
 return ob
for part in parts:
 verts=[];name=part['node'];mat=part['material']
 for x,y,z in part['vertices']:
  if name=='Adventurer_Body':
   # Tailored waist, narrower shoulders and a subtly shaped chest beneath the jacket.
   waist=math.exp(-((z-1.03)/.14)**2);shoulder=math.exp(-((z-1.39)/.14)**2)
   x*=1-.20*waist-.095*shoulder
   if abs(x)<.18 and y<-.035:
    y-=.045*math.exp(-((z-1.26)/.09)**2)*math.exp(-((abs(x)-.085)/.065)**2)
   if abs(x)>.23:y*=.91
  if name=='Adventurer_Legs':
   x*=1+.13*math.exp(-((z-.87)/.13)**2)
   if z>.96:x*=.91
  if name=='Adventurer_Head':
   # Softer jaw/chin and slightly finer nose; retain the original identity/skin tone.
   lower=max(0,min(1,(1.70-z)/.19));x*=1-.22*lower
   if z<1.54:z+=.012*(1.54-z)/.1
   if y<-.13 and 1.59<z<1.72:y=-.13+(y+.13)*.82
   if mat=='Eyebrows':z=1.707+(z-1.707)*.60
  verts.append((x,y,z))
 indices=part['indices']
 # Replace the entire rugged male hairstyle, including beard and moustache.
 if name=='Adventurer_Head' and mat in ['Hair','Eye']:indices=[]
 ob=add(name+'_'+str(part['index']),verts,indices,material(mat,part['color']))
 # Carry original production joint indices through Blender subdivision.
 for i in range(len(verts)):
  for k in range(4):
   weight=part['weights'][i*4+k]
   if weight<=0:continue
   name='J'+str(part['joints'][i*4+k]);group=ob.vertex_groups.get(name) or ob.vertex_groups.new(name=name);group.add([i],weight,'REPLACE')
 outputs.append((part,ob))
# Sculpted side-parted bob with layered locks and a swept fringe.
hair_mat=material('Female_ChestnutHair',(.095,.040,.021,1))
hair_verts=[];hair_indices=[]
def hairmesh(verts,faces):
 offset=len(hair_verts);hair_verts.extend(verts)
 for face in faces:
  for i in range(1,len(face)-1):hair_indices.extend([offset+face[0],offset+face[i],offset+face[i+1]])
N=48;ROWS=15;verts=[];faces=[]
for j in range(ROWS):
 t=j/(ROWS-1)
 for k in range(N):
  a=k*math.tau/N
  # front is negative Y. Open at eye level in front, shoulder length at sides/back.
  front=max(0,min(1,(-math.sin(a)-.15)/.55));front=front*front*(3-2*front)
  end=1.49+.285*front
  theta=min(t/.65,1)*(1.65-.40*front)
  radius=.123*math.sin(theta)*(1+.025*math.sin(a*9+t*4))
  z=1.73+.13*math.cos(theta)
  if t>.65:z+=(end-z)*(t-.65)/.35
  verts.append((radius*math.cos(a),-.045+radius*math.sin(a),z))
for j in range(ROWS-1):
 for k in range(N):a=j*N+k;b=j*N+(k+1)%N;faces.append((a,b,b+N,a+N))
hairmesh(verts,faces)
# Individual tapered locks break up the bob silhouette and form a swept hairline.
for strand in range(15):
 a=.05+strand*math.tau/15
 if math.sin(a)<-.75:continue
 verts=[];faces=[]
 for j in range(14):
  t=j/13;angle=a+.10*math.sin(t*3+strand)
  width=.15*(1-.75*t*t)
  for k in range(5):
   u=k/4-.5;theta=angle+u*width
   r=.072+.056*math.sin(t*math.pi/2)+.004*math.cos(u*math.pi*2)
   z=1.82-t*(.30+.045*math.sin(strand*2.7))
   verts.append((r*math.cos(theta),-.04+r*math.sin(theta),z))
 for j in range(13):
  for k in range(4):n=j*5+k;faces.append((n,n+1,n+6,n+5))
 hairmesh(verts,faces)
for strand in range(5):
 verts=[];faces=[]
 for j in range(18):
  t=j/17
  for k in range(5):
   u=k/4-.5;x=-.045+.16*t
   y=-.10-.058*math.sin(t*math.pi/2)-.002*strand
   z=1.842-.093*t-.007*strand+u*.022*(1-.8*t)
   verts.append((x,y,z))
 for j in range(17):
  for k in range(4):n=j*5+k;faces.append((n,n+1,n+6,n+5))
 hairmesh(verts,faces)
hair=add('Female layered bob',hair_verts,hair_indices,hair_mat)
# Subtle sculpted lips complete the clean-shaven face.
lip_mat=material('Female_NaturalLips',(.38,.19,.15,1))
lips=[]
for z,width,height in [(1.606,.026,.0045),(1.598,.024,.005)]:
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=(0,-.158,z));ob=bpy.context.object;ob.name='Natural lip';ob.scale=(width,.004,height)
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);ob.data.materials.append(lip_mat)
 for polygon in ob.data.polygons:polygon.use_smooth=True
 lips.append(ob)
# More detailed eyes use layered geometry rather than flat painted polygons.
head_joint=next(p['headJoint'] for p in parts if p['node']=='Adventurer_Head')
extras=[hair]+lips
for x in [-.045,.045]:
 for name,center,radii,color in [
  ('Eye_Sclera',(x,-.142,1.698),(.019,.009,.010),(.76,.73,.66,1)),
  ('Eye_Iris',(x,-.1508,1.698),(.008,.002,.008),(.10,.17,.13,1)),
  ('Eye_Pupil',(x,-.153,1.698),(.0035,.001,.0045),(.012,.016,.015,1))]:
  bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=center);ob=bpy.context.object;ob.name=name;ob.scale=radii
  bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);ob.data.materials.append(material(name,color))
  for face in ob.data.polygons:face.use_smooth=True
  extras.append(ob)
# Eyelid rims seat the eyes within the face instead of leaving exposed spheres.
skin_mat=materials['Skin']
for x in [-.045,.045]:
 for upper in [True,False]:
  verts=[];faces=[]
  for j in range(17):
   a=j*math.pi/16;xx=x+.020*math.cos(a);zz=1.698+(1 if upper else -1)*.009*math.sin(a)
   for k in range(6):
    b=k*math.tau/6
    verts.append((xx, -.149+.0025*math.cos(b),zz+.0025*math.sin(b)))
  for j in range(16):
   for k in range(6):n=j*6+k;m=j*6+(k+1)%6;faces.append((n,m,m+6,n+6))
  indices=[]
  for a,b,c,d in faces:indices.extend([a,b,c,a,c,d])
  extras.append(add('Sculpted eyelid',verts,indices,skin_mat))
for ob in extras:
 vg=ob.vertex_groups.new(name='J'+str(head_joint));vg.add(list(range(len(ob.data.vertices))),1,'REPLACE')
 outputs.append(({'node':'Adventurer_Head'},ob))
# Weld material seams before subdividing so the skin and jacket stay continuous.
joined=[]
for node in sorted(set(part['node'] for part,ob in outputs)):
 objects=[ob for part,ob in outputs if part['node']==node and len(ob.data.polygons)]
 bpy.ops.object.select_all(action='DESELECT')
 for ob in objects:ob.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();ob=bpy.context.object;ob.name=node
 bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bm.to_mesh(ob.data);bm.free()
 modifier=ob.modifiers.new('Anatomy surface refinement','SUBSURF');modifier.subdivision_type='CATMULL_CLARK';modifier.levels=1;modifier.render_levels=modifier.levels
 bpy.ops.object.modifier_apply(modifier=modifier.name)
 if node=='Adventurer_Body':
  # Shape the refined surface, not just the coarse cage, under the fitted outfit.
  for vertex in ob.data.vertices:
   x,y,z=vertex.co
   if y<-.035 and abs(x)<.20:
    chest=.038*math.exp(-((z-1.275)/.070)**2)*math.exp(-((abs(x)-.083)/.052)**2)
    vertex.co.y-=chest
  ob.data.update()
 if node in ['Adventurer_Body','Adventurer_Legs']:
  for vertex in ob.data.vertices:
   x,y,z=vertex.co
   if node=='Adventurer_Body':mask=math.exp(-((z-1.01)/.065)**2)+.5*math.exp(-((abs(x)-.29)/.07)**2)
   else:mask=math.exp(-((z-.5)/.09)**2)+.6*math.exp(-((z-.19)/.045)**2)
   vertex.co.y+=.003*mask*math.sin(z*145+x*28)
  ob.data.update()
 for face in ob.data.polygons:face.use_smooth=True
 joined.append((node,ob))
# Fine woven fabric texture and UVs, shared by the jacket and trousers.
fabric=bpy.data.images.new('Explorer woven fabric',width=128,height=128)
pixels=[]
for y in range(128):
 for x in range(128):
  value=.91+.045*math.sin(x*math.pi/2)*math.cos(y*math.pi/2)+.018*math.sin(x*1.73+y*2.31)
  pixels.extend([value,value,value,1])
fabric.pixels=pixels;fabric.filepath_raw=os.path.join(ROOT,'public/assets/character/female-fabric.png');fabric.file_format='PNG';fabric.save();fabric.pack()
for node,ob in joined:
 uv=ob.data.uv_layers.new(name='FabricUV')
 for loop in ob.data.loops:
  v=ob.data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(v.x*8,v.z*8)
for mat in materials.values():
 if not mat.name.startswith('Explorer_'):continue
 nodes=mat.node_tree.nodes;links=mat.node_tree.links;p=nodes.get('Principled BSDF')
 tex=nodes.new('ShaderNodeTexImage');tex.image=fabric
 mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[1].default_value=mat.diffuse_color
 links.new(tex.outputs['Color'],mix.inputs[2]);links.new(mix.outputs[0],p.inputs['Base Color'])
# Export the subdivided geometry and interpolated original skin weights together.
result=[]
for node,ob in joined:
 ob.data.calc_loop_triangles()
 for material_index,mat in enumerate(ob.data.materials):
  triangles=[tri for tri in ob.data.loop_triangles if tri.material_index==material_index]
  if not triangles:continue
  used=sorted(set(i for tri in triangles for i in tri.vertices));mapping={old:new for new,old in enumerate(used)}
  verts=[ob.data.vertices[i] for i in used];joints=[];weights=[]
  for vertex in verts:
   influences=sorted([(int(ob.vertex_groups[g.group].name[1:]),g.weight) for g in vertex.groups if g.weight>0],key=lambda item:-item[1])[:4]
   total=sum(w for j,w in influences)
   if not total:raise RuntimeError('Unweighted refined vertex')
   influences += [(0,0)]*(4-len(influences))
   joints.extend(j for j,w in influences);weights.extend(w/total for j,w in influences)
  result.append({'node':node,'material':mat.name,'color':list(mat.diffuse_color),'vertices':[list(v.co) for v in verts],'normals':[list(v.normal) for v in verts],
   'indices':[mapping[i] for tri in triangles for i in tri.vertices],'joints':joints,'weights':weights})
with open(os.path.join(ROOT,'scripts/art/female-sculpt.json'),'w') as f:json.dump(result,f)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.world.color=(.04,.04,.04)
bpy.ops.object.camera_add(location=(2.5,-5,2.3));c=bpy.context.object;c.rotation_euler=(Vector((0,0,.94))-c.location).to_track_quat('-Z','Y').to_euler();c.data.type='ORTHO';c.data.ortho_scale=2.25;scene.camera=c
for pos,power in [((2,-3,4),400),((-3,-1,3),220),((1,3,3),350)]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.size=3;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
scene.render.resolution_x=800;scene.render.resolution_y=1050;scene.render.resolution_percentage=100;scene.render.filepath=os.path.join(ROOT,'scripts/art/female-preview.png')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'scripts/art/female-explorer.blend'))
bpy.ops.render.render(write_still=True)
