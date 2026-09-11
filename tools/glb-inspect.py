"""Inspect a .glb: apply scene-graph transforms and report real geometry
(bounding box, proportions, node names) plus an orthographic preview render.
Pure stdlib - no numpy/PIL needed.

usage: python3 tools/glb-inspect.py models/ds4.glb [outprefix]
"""
import struct, json, zlib, math, sys

PATH = sys.argv[1] if len(sys.argv) > 1 else 'models/ds4.glb'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/glb'

d = open(PATH, 'rb').read()
magic, ver, total = struct.unpack('<4sII', d[:12])
off, J, B = 12, None, None
while off < len(d):
    clen, ctype = struct.unpack('<I4s', d[off:off+8])
    body = d[off+8:off+8+clen]
    if ctype == b'JSON': J = json.loads(body)
    elif ctype[:3] == b'BIN': B = body
    off += 8 + clen

CT = {5120:('b',1), 5121:('B',1), 5122:('h',2), 5123:('H',2), 5125:('I',4), 5126:('f',4)}
NC = {'SCALAR':1, 'VEC2':2, 'VEC3':3, 'VEC4':4, 'MAT4':16}

def acc(i):
    a = J['accessors'][i]
    n = NC[a['type']]; fmt, sz = CT[a['componentType']]
    if 'bufferView' not in a: return [(0.0,)*n] * a['count']
    bv = J['bufferViews'][a['bufferView']]
    base = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride') or (n * sz)
    return [struct.unpack_from('<'+fmt*n, B, base + k*stride) for k in range(a['count'])]

def mid(): return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
def mm(a, b):
    r = [0.0]*16
    for c in range(4):
        for row in range(4):
            r[c*4+row] = sum(a[k*4+row]*b[c*4+k] for k in range(4))
    return r
def nmat(n):
    if 'matrix' in n: return list(n['matrix'])
    t = n.get('translation', [0,0,0]); q = n.get('rotation', [0,0,0,1]); s = n.get('scale', [1,1,1])
    x,y,z,w = q
    R = [1-2*(y*y+z*z), 2*(x*y+z*w), 2*(x*z-y*w), 0,
         2*(x*y-z*w), 1-2*(x*x+z*z), 2*(y*z+x*w), 0,
         2*(x*z+y*w), 2*(y*z-x*w), 1-2*(x*x+y*y), 0, 0,0,0,1]
    S = [s[0],0,0,0, 0,s[1],0,0, 0,0,s[2],0, 0,0,0,1]
    m = mm(R, S); m[12], m[13], m[14] = t
    return m
def xf(m, p):
    x,y,z = p[0], p[1], p[2]
    return (m[0]*x+m[4]*y+m[8]*z+m[12], m[1]*x+m[5]*y+m[9]*z+m[13], m[2]*x+m[6]*y+m[10]*z+m[14])

tris, parts = [], {}
def walk(ni, par):
    n = J['nodes'][ni]
    M = mm(par, nmat(n))
    if 'mesh' in n:
        name = n.get('name', 'mesh%d' % n['mesh'])
        for prim in J['meshes'][n['mesh']].get('primitives', []):
            at = prim.get('attributes', {})
            if 'POSITION' not in at: continue
            P = [xf(M, p) for p in acc(at['POSITION'])]
            idx = [v[0] for v in acc(prim['indices'])] if 'indices' in prim else list(range(len(P)))
            mi = prim.get('material')
            mn = J.get('materials', [{}])[mi].get('name', '?') if mi is not None else '-'
            parts.setdefault(name, {'tris':0, 'mat':mn})
            parts[name]['tris'] += len(idx)//3
            for t in range(0, len(idx)-2, 3):
                tris.append((P[idx[t]], P[idx[t+1]], P[idx[t+2]]))
    for c in n.get('children', []): walk(c, M)

for ni in J['scenes'][J.get('scene', 0)]['nodes']: walk(ni, mid())

lo = [1e18]*3; hi = [-1e18]*3
for a,b,c in tris:
    for p in (a,b,c):
        for k in range(3):
            lo[k] = min(lo[k], p[k]); hi[k] = max(hi[k], p[k])
size = [hi[k]-lo[k] for k in range(3)]
print("file      : %s (%.1f MB)" % (PATH, len(d)/1e6))
print("asset     : %s" % json.dumps(J.get('asset', {}).get('extras', J.get('asset', {})))[:200])
print("triangles : %d   meshes: %d   materials: %d   textures: %d"
      % (len(tris), len(parts), len(J.get('materials', [])), len(J.get('textures', []))))
print("bbox      : X %.4f  Y %.4f  Z %.4f" % tuple(size))
dims = sorted(size, reverse=True)
print("sorted    : %.4f  %.4f  %.4f" % tuple(dims))
print("ratios    : mid/max %.4f   min/max %.4f" % (dims[1]/dims[0], dims[2]/dims[0]))
print("  DualShock4 (162x98x57mm) : %.4f / %.4f" % (98/162, 57/162))
print("  DualSense  (160x106x66mm): %.4f / %.4f" % (106/160, 66/160))
sc = 16.2/dims[0]
print("scaled to 16.2cm wide -> depth %.2f cm, thickness %.2f cm" % (dims[1]*sc, dims[2]*sc))
print("\nmesh nodes:")
for k, v in sorted(parts.items(), key=lambda kv: -kv[1]['tris'])[:40]:
    print("  %-42s %6d tris   mat=%s" % (k[:42], v['tris'], v['mat']))

def render(out, au, av, aw, fu=1, fv=1, W=680, H=520):
    us = [fu*p[au] for t in tris for p in t]
    vs = [fv*p[av] for t in tris for p in t]
    u0,u1 = min(us), max(us); v0,v1 = min(vs), max(vs)
    s = min(W*0.88/(u1-u0), H*0.88/(v1-v0))
    cu, cv = (u0+u1)/2, (v0+v1)/2
    zb = [-1e18]*(W*H); fb = [(14,15,18)]*(W*H)
    L = (0.40, 0.62, 0.68)
    for a,b,c in tris:
        A = (W/2+(fu*a[au]-cu)*s, H/2-(fv*a[av]-cv)*s, a[aw])
        Bp= (W/2+(fu*b[au]-cu)*s, H/2-(fv*b[av]-cv)*s, b[aw])
        C = (W/2+(fu*c[au]-cu)*s, H/2-(fv*c[av]-cv)*s, c[aw])
        e1 = (b[0]-a[0], b[1]-a[1], b[2]-a[2]); e2 = (c[0]-a[0], c[1]-a[1], c[2]-a[2])
        nx = e1[1]*e2[2]-e1[2]*e2[1]; ny = e1[2]*e2[0]-e1[0]*e2[2]; nz = e1[0]*e2[1]-e1[1]*e2[0]
        nl = math.sqrt(nx*nx+ny*ny+nz*nz) or 1
        lam = abs((nx*L[0]+ny*L[1]+nz*L[2])/nl)
        sh = int(38+200*lam); col = (min(255,sh), min(255,sh), min(255,int(sh*1.03)))
        minx = max(0,int(min(A[0],Bp[0],C[0]))); maxx = min(W-1,int(max(A[0],Bp[0],C[0]))+1)
        miny = max(0,int(min(A[1],Bp[1],C[1]))); maxy = min(H-1,int(max(A[1],Bp[1],C[1]))+1)
        den = (Bp[1]-C[1])*(A[0]-C[0]) + (C[0]-Bp[0])*(A[1]-C[1])
        if abs(den) < 1e-12: continue
        for py in range(miny, maxy+1):
            for px in range(minx, maxx+1):
                w1 = ((Bp[1]-C[1])*(px+.5-C[0])+(C[0]-Bp[0])*(py+.5-C[1]))/den
                w2 = ((C[1]-A[1])*(px+.5-C[0])+(A[0]-C[0])*(py+.5-C[1]))/den
                w3 = 1-w1-w2
                if w1<0 or w2<0 or w3<0: continue
                z = w1*A[2]+w2*Bp[2]+w3*C[2]; i = py*W+px
                if z > zb[i]: zb[i] = z; fb[i] = col
    raw = b''.join(b'\x00'+b''.join(bytes(fb[y*W+x]) for x in range(W)) for y in range(H))
    ch = lambda tag,data: struct.pack('>I',len(data))+tag+data+struct.pack('>I',zlib.crc32(tag+data)&0xffffffff)
    open(out,'wb').write(b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',W,H,8,2,0,0,0))
                         +ch(b'IDAT',zlib.compress(raw,6))+ch(b'IEND',b''))
    print("wrote", out)

order = sorted(range(3), key=lambda k: -size[k])
render(OUT+'_a.png', order[0], order[1], order[2])
render(OUT+'_b.png', order[0], order[2], order[1])
