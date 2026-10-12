"""Restyle the existing Quaternius character without replacing its skeleton or clips."""
import bpy,os,json
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,'scripts/art/adventurer-original.glb'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
# Give materials distinctive names so the runtime does not overwrite the design.
palette={'Green':(.025,.18,.20),'LightGreen':(.46,.60,.53),'Brown':(.23,.12,.065),'Brown2':(.055,.075,.085),'Grey':(.16,.21,.23),'Black':(.018,.026,.031),'Gold':(.65,.36,.10)}
for material in bpy.data.materials:
 if material.name not in palette:continue
 name=material.name;color=palette[name];material.diffuse_color=(*color,1)
 p=material.node_tree.nodes.get('Principled BSDF')
 if p:
  p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.72
  p.inputs['Metallic'].default_value=.6 if name=='Gold' else 0
 material.name='Explorer_'+name
# Trousers are uniformly charcoal, leaving leather on the belt, pack, and boots.
legs=bpy.data.objects.get('Adventurer_Legs')
for i,m in enumerate(legs.data.materials):
 if m.name=='Explorer_Brown':
  cloth=m.copy();cloth.name='Explorer_TrouserPanels';cloth.diffuse_color=(.08,.11,.12,1);cloth.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=cloth.diffuse_color;legs.data.materials[i]=cloth
# Small bevels catch light on clothing while preserving original weights.
for ob in list(bpy.context.scene.objects):
 if ob.type!='MESH' or ob.name=='Icosphere':continue
 if ob.name in ['Adventurer_Body','Backpack','Adventurer_Feet']:
  bevel=ob.modifiers.new('Soft garment edges','BEVEL');bevel.width=.00004;bevel.segments=2;bevel.affect='EDGES';bevel.limit_method='ANGLE';bevel.angle_limit=.6
  # Apply before the armature so the exported rest mesh keeps its skinning.
  bpy.context.view_layer.objects.active=ob
  while ob.modifiers.find(bevel.name)>0:bpy.ops.object.modifier_move_up(modifier=bevel.name)
  bpy.ops.object.modifier_apply(modifier=bevel.name)
# Export mesh data directly before animation sampling alters object transforms.
mesh_data=[]
for ob in bpy.context.scene.objects:
 if ob.type!='MESH' or ob.name=='Icosphere':continue
 ob.data.calc_loop_triangles();normal_matrix=ob.matrix_world.to_3x3().inverted().transposed()
 vertices=[]
 for v in ob.data.vertices:
  p=ob.matrix_world@v.co;n=(normal_matrix@v.normal).normalized()
  weights=sorted([(ob.vertex_groups[g.group].name,g.weight) for g in v.groups if g.weight>0],key=lambda x:-x[1])[:4]
  vertices.append({'p':[p.x,p.z,-p.y],'n':[n.x,n.z,-n.y],'w':weights})
 mesh_data.append({'name':ob.name,'vertices':vertices,'faces':[[list(t.vertices),t.material_index] for t in ob.data.loop_triangles],'materials':[m.name for m in ob.data.materials]})
with open(os.path.join(ROOT,'scripts/art/player-meshes.json'),'w') as f:json.dump(mesh_data,f)
# Preserve all imported animation tracks and end markers needed by procedural poses.
models=[o for o in bpy.context.scene.objects if o.name!='Icosphere']
bpy.ops.object.select_all(action='DESELECT')
for ob in models:ob.select_set(True)
bpy.context.view_layer.objects.active=rig
# Preview the exact palette under balanced studio lighting.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.world.color=(.045,.045,.045)
bpy.ops.object.camera_add(location=(3,-5,2.4));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.9))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=2.35;scene.camera=camera
for loc,power in [((2,-3,4),450),((-3,-1,3),220),((1,3,3),350)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=3;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
scene.render.resolution_x=750;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.render.filepath=os.path.join(ROOT,'scripts/art/player-preview.png')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'scripts/art/explorer-player.blend'))
bpy.ops.render.render(write_still=True)

bpy.ops.object.select_all(action='DESELECT')
for ob in models:ob.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'scripts/art/adventurer-blender.glb'),export_format='GLB',use_selection=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True)
