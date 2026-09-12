import bpy, json
from pathlib import Path

root = Path(r'G:\Projects\Agent\Agent Cli\天枢\天枢-WebDemo-v3.0\assets')
selection = {
    'furniture': ['bedBunk','bookcaseOpen','desk','chairDesk','loungeSofa','pottedPlant','washer','computerScreen','kitchenCoffeeMachine','laptop','cardboardBoxClosed','tableRound','lampRoundFloor'],
    'nature': ['tree_oak','tree_detailed_fall','plant_bushDetailed','grass_large','flower_redA','flower_yellowC','rock_largeA','canoe','fence_planks','lily_large']
}
scene = bpy.data.scenes.new('Tianshu_CC0_Asset_Conversion')
bpy.context.window.scene = scene
result = {}
for pack, names in selection.items():
    for name in names:
        before = set(scene.objects)
        bpy.ops.import_scene.gltf(filepath=str(root / ('kenney-'+pack) / 'Models' / 'GLTF format' / (name+'.glb')))
        added = set(scene.objects) - before
        parts = []
        for obj in added:
            if obj.type != 'MESH': continue
            me = obj.data
            me.calc_loop_triangles()
            groups = {}
            for tri in me.loop_triangles:
                material = me.materials[tri.material_index] if me.materials else None
                color = (0.5,0.5,0.5)
                if material and material.use_nodes:
                    bsdf = next((n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'),None)
                    if bsdf: color = tuple(bsdf.inputs['Base Color'].default_value[:3])
                    tex = next((n for n in material.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image),None)
                    if tex and me.uv_layers.active:
                        uv = me.uv_layers.active.data[tri.loops[0]].uv
                        img=tex.image; w,h=img.size
                        ix = (int(uv.x*w)%w + (int(uv.y*h)%h)*w)*4
                        srgb = img.pixels[ix:ix+3]
                        color = tuple(((v+.055)/1.055)**2.4 if v>.04045 else v/12.92 for v in srgb)
                key = tuple(round(v,4) for v in color)
                vertices = groups.setdefault(key,[])
                for vi in tri.vertices:
                    p=obj.matrix_world @ me.vertices[vi].co
                    vertices.extend([round(p.x,4),round(p.z,4),round(-p.y,4)])
            for color, positions in groups.items(): parts.append({'color':color,'positions':positions})
        result[name]=parts
        for obj in added: bpy.data.objects.remove(obj,do_unlink=True)
(root/'kenney-meshes.js').write_text('globalThis.KENNEY_MESHES='+json.dumps(result,separators=(',',':'))+';',encoding='utf-8')
print('Converted',len(result),'CC0 models:',(root/'kenney-meshes.js').stat().st_size,'bytes')
