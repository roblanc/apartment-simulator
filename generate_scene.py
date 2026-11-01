#!/usr/bin/env python3
import json
import math

# 1. Define layout of rooms per releveu (Bd. N. Titulescu 94, ap. 160)
# (x right, y down, meters)
layout = {
    'Balcon': [(2.67, 0.0), (6.88, 0.0), (6.88, 4.53), (5.81, 4.53), (5.81, 1.31), (2.67, 1.31)],
    'Dormitor': [(0.0, 1.31), (2.67, 1.31), (2.67, 5.36), (0.0, 5.36)],
    'Birou': [(2.67, 1.31), (5.81, 1.31), (5.81, 5.36), (2.67, 5.36)],
    'Baie': [(3.55, 5.36), (5.81, 5.36), (5.81, 7.12), (3.55, 7.12)],
    'HolSus': [(0.41, 5.36), (3.55, 5.36), (3.55, 7.12), (0.41, 7.12)],
    'HolJos': [(0.0, 7.12), (1.96, 7.12), (1.96, 10.01), (0.0, 10.01)],
    'Vestibul': [(-2.92, 7.12), (0.0, 7.12), (0.0, 8.42), (-2.92, 8.42)],
    'Sufragerie': [(1.96, 7.12), (5.81, 7.12), (5.81, 11.98), (1.96, 11.98)],
    'Bucatarie': [(0.0, 10.01), (1.89, 10.01), (1.89, 13.71), (0.0, 13.71)],
    'Logie': [(1.89, 11.98), (4.54, 11.98), (4.54, 13.10), (1.89, 13.10)]
}

# Display names and floor presets
zone_info = {
    'Balcon':     {'name': 'Balcon',     'preset': 'wood', 'color': '#f0ece3', 'seed': [4.5, 0.65]},
    'Dormitor':   {'name': 'Dormitor',   'preset': 'wood', 'color': '#f0ece3', 'seed': [1.33, 3.33]},
    'Birou':      {'name': 'Birou',      'preset': 'wood', 'color': '#f0ece3', 'seed': [4.24, 3.33]},
    'Baie':       {'name': 'Baie',       'preset': 'tile', 'color': '#cfcdc6', 'seed': [4.68, 6.24]},
    'HolSus':     {'name': 'Hol Sus',    'preset': 'wood', 'color': '#f0ece3', 'seed': [1.98, 6.24]},
    'HolJos':     {'name': 'Hol Jos',    'preset': 'wood', 'color': '#f0ece3', 'seed': [0.98, 8.56]},
    'Vestibul':   {'name': 'Vestibul',   'preset': 'wood', 'color': '#f0ece3', 'seed': [-1.46, 7.77]},
    'Sufragerie': {'name': 'Sufragerie', 'preset': 'wood', 'color': '#f0ece3', 'seed': [3.88, 9.55]},
    'Bucatarie':  {'name': 'Bucătărie',  'preset': 'tile', 'color': '#cfcdc6', 'seed': [0.94, 11.86]},
    'Logie':      {'name': 'Logie',      'preset': 'wood', 'color': '#f0ece3', 'seed': [3.21, 12.54]}
}

def polygon_area(pts):
    a = 0.0
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2.0

print("=" * 60)
print("VERIFICARE ARII CALCULATE DUPĂ RELEVEU:")
print("=" * 60)
total_area = 0.0
for zid, pts in layout.items():
    area = polygon_area(pts)
    total_area += area
    print(f"{zone_info[zid]['name']:12}: {area:6.2f} m² (raw: {zid})")
print("-" * 60)
print(f"TOTAL SUPRAFAȚĂ UTILĂ: {total_area:6.2f} m²")
print("=" * 60)

# Refine polygons so that all intersecting / T-junction points are inserted as vertices.
# This ensures that every atomic wall matches an exact polygon edge for wallZoneCount.
def refine_polygons(zones):
    refined = {}
    for rname, pts in zones.items():
        new_pts = []
        n = len(pts)
        for i in range(n):
            p1 = pts[i]
            p2 = pts[(i + 1) % n]
            new_pts.append((round(p1[0], 2), round(p1[1], 2)))
            inter = []
            if abs(p1[1] - p2[1]) < 1e-4:  # horizontal segment
                y = p1[1]
                min_x, max_x = min(p1[0], p2[0]), max(p1[0], p2[0])
                for other_pts in zones.values():
                    for op in other_pts:
                        if abs(op[1] - y) < 1e-4 and min_x + 1e-4 < op[0] < max_x - 1e-4:
                            inter.append(round(op[0], 2))
                inter = sorted(list(set(inter)))
                if p1[0] > p2[0]:
                    inter = inter[::-1]
                for ix in inter:
                    new_pts.append((ix, round(y, 2)))
            elif abs(p1[0] - p2[0]) < 1e-4:  # vertical segment
                x = p1[0]
                min_y, max_y = min(p1[1], p2[1]), max(p1[1], p2[1])
                for other_pts in zones.values():
                    for op in other_pts:
                        if abs(op[0] - x) < 1e-4 and min_y + 1e-4 < op[1] < max_y - 1e-4:
                            inter.append(round(op[1], 2))
                inter = sorted(list(set(inter)))
                if p1[1] > p2[1]:
                    inter = inter[::-1]
                for iy in inter:
                    new_pts.append((round(x, 2), iy))
        refined[rname] = new_pts
    return refined

refined_layout = refine_polygons(layout)

# Deduplicate edges to create walls
edges_map = {}
for rname, pts in refined_layout.items():
    n = len(pts)
    for i in range(n):
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        canon = (min(p1, p2), max(p1, p2))
        edges_map.setdefault(canon, []).append(rname)

walls = {}
wall_idx = 1
for (p1, p2), rlist in sorted(edges_map.items()):
    # Skip boundary between HolSus and HolJos so the hallway remains open
    if set(rlist) in ({'HolSus', 'HolJos'}, {'Vestibul', 'HolJos'}):
        continue
    length = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
    wid = f"wall_{wall_idx:02d}_{p1[0]}_{p1[1]}_{p2[0]}_{p2[1]}".replace('-', 'm').replace('.', '_')
    walls[(p1, p2)] = {
        'id': wid,
        'name': f'Wall {wall_idx}',
        'start': list(p1),
        'end': list(p2),
        'length': length,
        'rooms': rlist
    }
    wall_idx += 1

print(f"\nDeduplicare pereți: {len(walls)} pereți unici generați.")

def get_wall(p1, p2):
    p1 = (round(p1[0], 2), round(p1[1], 2))
    p2 = (round(p2[0], 2), round(p2[1], 2))
    c = (min(p1, p2), max(p1, p2))
    if c not in walls:
        raise KeyError(f"Wall for endpoints {p1} -> {p2} (canon {c}) not found!")
    return walls[c]

# Build nodes dictionary
nodes = {
    "site_root": {
        "object": "node",
        "id": "site_root",
        "type": "site",
        "parentId": None,
        "visible": True,
        "metadata": {},
        "polygon": {"type": "polygon", "points": [[-15, -15], [15, -15], [15, 15], [-15, 15]]},
        "children": ["building_root"]
    },
    "building_root": {
        "object": "node",
        "id": "building_root",
        "type": "building",
        "parentId": "site_root",
        "visible": True,
        "metadata": {},
        "children": ["level_root"]
    },
    "level_root": {
        "object": "node",
        "id": "level_root",
        "type": "level",
        "parentId": "building_root",
        "visible": True,
        "metadata": {},
        "children": [],
        "level": 0,
        "baseElevation": 0,
        "height": 2.7
    }
}

level_children = []

# Add zones and ceilings
for zid, pts in refined_layout.items():
    znode_id = f"zone_{zid.lower()}"
    cnode_id = f"ceiling_{zid.lower()}"
    info = zone_info[zid]
    
    zone_node = {
        "object": "node",
        "id": znode_id,
        "type": "zone",
        "name": info['name'],
        "parentId": "level_root",
        "visible": True,
        "metadata": {},
        "polygon": [list(p) for p in pts],
        "holes": [],
        "seed": info['seed'],
        "floor": {
            "finish": {
                "preset": info['preset'],
                "properties": {
                    "color": info['color'],
                    "roughness": 0.45 if info['preset'] == 'wood' else 0.3
                }
            }
        }
    }
    
    ceiling_node = {
        "object": "node",
        "id": cnode_id,
        "type": "ceiling",
        "name": f"{info['name']} Ceiling",
        "parentId": "level_root",
        "visible": True,
        "metadata": {},
        "children": [],
        "polygon": [list(p) for p in pts],
        "holes": [],
        "zoneId": znode_id
    }
    
    nodes[znode_id] = zone_node
    nodes[cnode_id] = ceiling_node
    level_children.extend([znode_id, cnode_id])

# Add walls
for w in walls.values():
    wnode = {
        "object": "node",
        "id": w['id'],
        "type": "wall",
        "name": w['name'],
        "parentId": "level_root",
        "visible": True,
        "metadata": {"rooms": w['rooms']},
        "children": [],
        "start": w['start'],
        "end": w['end'],
        "frontSide": "interior",
        "backSide": "interior"
    }
    nodes[w['id']] = wnode
    level_children.append(w['id'])

# Define Doors
door_specs = [
    # (name, p1, p2, width, height, pos)
    ("Door Intrare",          (-2.92, 7.12), (-2.92, 8.42), 0.90, 2.10, 0.65),
    # Door Vestibul-Hol removed (clean open entrance)
    ("Door Hol-Dormitor",      (0.41, 5.36),  (2.67, 5.36), 0.85, 2.10, 1.15),
    ("Door Hol-Birou",         (2.67, 5.36),  (3.55, 5.36), 0.75, 2.10, 0.44),
    ("Door Hol-Baie",          (3.55, 5.36),  (3.55, 7.12), 0.80, 2.10, 0.88),
    ("Door Hol-Bucatarie",     (0.00, 10.01), (1.89, 10.01), 0.85, 2.10, 0.95),
    ("Door Hol-Living",        (1.96, 7.12),  (1.96, 10.01), 0.90, 2.10, 1.45),
    ("Door Living-Logie",      (1.96, 11.98), (4.54, 11.98), 0.90, 2.10, 1.10),
    ("Door Birou-Balcon",      (5.81, 1.31),  (5.81, 4.53),  0.85, 2.10, 0.80)
]

door_idx = 1
for name, p1, p2, width, height, pos in door_specs:
    wall = get_wall(p1, p2)
    did = f"door_{door_idx:02d}"
    dnode = {
        "object": "node",
        "id": did,
        "type": "door",
        "name": name,
        "parentId": "level_root",
        "visible": True,
        "metadata": {},
        "wallId": wall['id'],
        "position": [pos, height / 2.0, 0],
        "width": width,
        "height": height
    }
    nodes[did] = dnode
    level_children.append(did)
    door_idx += 1

# Define Windows
window_specs = [
    # (name, p1, p2, width, height, pos, y_center)
    ("Window Dormitor North",       (0.00, 1.31),  (2.67, 1.31),  1.40, 1.50, 1.33, 1.25),
    ("Window Birou Balcon North",   (2.67, 1.31),  (5.81, 1.31),  1.50, 1.50, 1.57, 1.25),
    # Birou east wall has the balcony door
    ("Window Balcon North 1",       (2.67, 0.00),  (6.88, 0.00),  1.40, 1.50, 1.25, 1.25),
    ("Window Balcon North 2",       (2.67, 0.00),  (6.88, 0.00),  1.40, 1.50, 2.95, 1.25),
    ("Window Balcon East 1",        (6.88, 0.00),  (6.88, 4.53),  1.40, 1.50, 1.35, 1.25),
    ("Window Balcon East 2",        (6.88, 0.00),  (6.88, 4.53),  1.40, 1.50, 3.15, 1.25),
    ("Window Balcon South",         (5.81, 4.53),  (6.88, 4.53),  0.70, 1.50, 0.53, 1.25),
    ("Window Balcon West",          (2.67, 0.00),  (2.67, 1.31),  0.80, 1.50, 0.65, 1.25),
    ("Window Sufragerie Logie",     (1.96, 11.98), (4.54, 11.98), 1.30, 1.50, 2.00, 1.25),
    ("Window Baie East",            (5.81, 5.36),  (5.81, 7.12),  0.80, 0.80, 0.88, 1.50),
    ("Window Bucatarie South",      (0.00, 13.71), (1.89, 13.71), 1.20, 1.50, 0.95, 1.25),
    ("Window Logie South",          (1.89, 13.10), (4.54, 13.10), 2.00, 1.50, 1.32, 1.25)
]

win_idx = 1
for name, p1, p2, width, height, pos, y_center in window_specs:
    wall = get_wall(p1, p2)
    wid = f"window_{win_idx:02d}"
    wnode = {
        "object": "node",
        "id": wid,
        "type": "window",
        "name": name,
        "parentId": "level_root",
        "visible": True,
        "metadata": {},
        "wallId": wall['id'],
        "position": [pos, y_center, 0],
        "width": width,
        "height": height
    }
    nodes[wid] = wnode
    level_children.append(wid)
    win_idx += 1

nodes["level_root"]["children"] = level_children

output_data = {
    "nodes": nodes,
    "rootNodeIds": ["site_root"],
    "collections": {},
    "materials": {}
}

output_path = "/Users/romica/Desktop/apartment-simulator/scene.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(output_data, f, indent=2, ensure_ascii=False)

print(f"\nGenerat cu succes: {output_path}")
print(f"- Zone: {len(refined_layout)}")
print(f"- Tavane: {len(refined_layout)}")
print(f"- Pereți: {len(walls)}")
print(f"- Uși: {len(door_specs)}")
print(f"- Ferestre: {len(window_specs)}")
