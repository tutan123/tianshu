"""Original campus landmark, authored in Blender and exported as portable mesh data."""
import bpy
import json
import math
from pathlib import Path
from mathutils import Vector

out = Path(r'G:\Projects\Agent\Agent Cli\天枢\天枢-WebDemo-v3.0\assets')
scene = bpy.data.scenes.new('Tianshu_Clocktower_Art')
bpy.context.window.scene = scene
scene.blendermcp_server_running = True

def material(name, color, metal=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = .6
    p.inputs['Metallic'].default_value = metal
    return m

brick = material('Terracotta masonry', (.46, .15, .095))
trim = material('Limestone cornices', (.76, .73, .60))
roof = material('Oxidized copper roof', (.075, .19, .18), .3)
glass = material('Blue window glass', (.045, .14, .19), .35)
gold = material('Clock brass', (.68, .41, .12), .65)
dark = material('Door iron', (.035, .045, .045))

def cube(name, loc, size, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    return o

def roof_pyramid(name, x, y, z, w, d, h):
    vertices = [(-w/2,-d/2,0),(w/2,-d/2,0),(w/2,d/2,0),(-w/2,d/2,0),(0,0,h)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], [(0,1,4),(1,2,4),(2,3,4),(3,0,4),(3,2,1,0)])
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.location = (x,y,z)
    obj.data.materials.append(roof)

for x in [-6.2, 6.2]:
    cube('Academic wing', (x,0,3.2), (8.2,6.4,6.4), brick)
    for z in [.35,2.2,4.4,6.3]:
        cube('Wing stone course', (x,0,z), (8.5,6.7,.22), trim)
    roof_pyramid('Wing copper roof',x,0,6.5,8.8,7,1.8)
    for xx in [-2.7,-.9,.9,2.7]:
        for z in [1.35,3.25,5.3]:
            for y in [-3.24,3.24]:
                cube('Window surround',(x+xx,y,z),(1.17,.16,1.35),trim)
                cube('Window glazing',(x+xx,y+(-.10 if y<0 else .10),z),(.87,.08,1.05),glass)
                cube('Window mullion',(x+xx,y+(-.15 if y<0 else .15),z),(.065,.07,1.05),trim)

cube('Tower base',(0,-.5,4.2),(4.9,7.4,8.4),brick)
cube('Clock stage',(0,-.5,10.2),(4.3,5.3,4),trim)
for z,w,d in [(.3,5.4,7.8),(6.6,5.2,7.7),(8.3,5.3,7.8),(12.2,4.8,5.8)]:
    cube('Tower cornice',(0,-.5,z),(w,d,.35),trim)
for x in [-2.35,2.35]:
    cube('Tower pilaster',(x,-4.22,4.15),(.36,.35,7.8),trim)
cube('Entry shadow',(0,-4.22,1.75),(2.8,.14,3.2),dark)
for x in [-1.7,1.7]:
    cube('Entry pillar',(x,-4.5,1.8),(.4,.7,3.6),trim)
cube('Entry lintel',(0,-4.5,3.6),(3.8,.8,.38),trim)
for i in range(4):
    cube('Entrance stair',(0,-4.65-i*.42,.56-i*.14),(4.8,.6,.2),trim)
for x in [-.9,.9]:
    cube('Tower arched window',(x,-4.25,5.25),(.8,.2,1.7),glass)

for y,rotation in [(-3.18,math.pi/2),(2.18,-math.pi/2)]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=1.5, depth=.15, location=(0,y,10.3),rotation=(rotation,0,0))
    bpy.context.object.name='Clock face'
    bpy.context.object.data.materials.append(trim)
    for i in range(12):
        angle=i*math.pi/6
        o=cube('Clock hour',(math.sin(angle)*1.22,y+(-.12 if y<0 else .12),10.3+math.cos(angle)*1.22),(.085,.08,.21),gold)
        o.rotation_euler.y=angle
    cube('Clock minute',(0,y+(-.16 if y<0 else .16),10.8),(.09,.08,1.05),dark)
    hand=cube('Clock hour hand',(.27,y+(-.18 if y<0 else .18),10.45),(.7,.08,.10),dark)
    hand.rotation_euler.y=-.35
roof_pyramid('Clocktower roof',0,-.5,12.45,5.3,6.3,2.9)
bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=.24,location=(0,-.5,15.55))
bpy.context.object.data.materials.append(gold)
cube('Roof finial',(0,-.5,15.85),(.08,.08,.9),gold)

# Export evaluated, triangulated meshes grouped by material. Axis conversion: Blender Z-up -> Three Y-up.
groups={}
deps=bpy.context.evaluated_depsgraph_get()
for obj in list(scene.objects):
    if obj.type!='MESH': continue
    evaluated=obj.evaluated_get(deps)
    mesh=evaluated.to_mesh()
    mesh.calc_loop_triangles()
    mat=obj.data.materials[0]
    data=groups.setdefault(mat.name,{'name':mat.name,'color':list(mat.diffuse_color[:3]),'positions':[]})
    for triangle in mesh.loop_triangles:
        for index in triangle.vertices:
            v=obj.matrix_world @ mesh.vertices[index].co
            data['positions'].extend([round(v.x,4),round(v.z,4),round(-v.y,4)])
    evaluated.to_mesh_clear()
(out/'clocktower-mesh.js').write_text('globalThis.CLOCKTOWER_MESH='+json.dumps(list(groups.values()),separators=(',',':'))+';',encoding='utf-8')

scene.world=bpy.data.worlds.new('Campus daylight')
scene.world.use_nodes=True
bg=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND')
bg.inputs[0].default_value=(.32,.43,.5,1)
bg.inputs[1].default_value=.5
cube('Preview ground',(0,0,-.35),(65,65,.3),material('Preview grass',(.18,.26,.20)))
bpy.ops.object.light_add(type='AREA',location=(4,-10,22))
bpy.context.object.data.energy=3500
bpy.context.object.data.shape='DISK'
bpy.context.object.data.size=15
bpy.context.object.rotation_euler=(Vector((0,0,5))-bpy.context.object.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(25,-35,24))
camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,6))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'
camera.data.ortho_scale=30
scene.camera=camera
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.render.resolution_x=1280
scene.render.resolution_y=960
scene.render.resolution_percentage=100
scene.render.filepath=str(out/'clocktower-render.png')
bpy.ops.wm.save_as_mainfile(filepath=str(out/'tianshu-clocktower.blend'))
bpy.ops.render.render(write_still=True)
print({'scene':scene.name,'mesh_groups':len(groups),'output':str(out/'clocktower-mesh.js')})
