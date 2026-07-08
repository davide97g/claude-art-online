# Run the White City builder in EXPORT mode -> public/assets/models/minas_city.glb
# Usage: python3 blender/blender_client.py exec blender/minas_export.py
MODE = 'export'
exec(open('/Users/davideghiotto/Desktop/projects/claude-art-online/blender/minas_build.py').read())
