from pathlib import Path
import numpy as np, math, wave, subprocess, base64, json
from PIL import Image,ImageDraw,ImageFont,ImageFilter
D=Path(__file__).resolve().parents[1]/'preview'
FPS=60; DUR=9.8; SR=48000
C=(103,232,249); WHITE=(248,250,252); GREEN=(125,226,177)
fontpath=Path(__file__).resolve().parents[1]/'fonts'/'welcome-text-subset.ttf'
font=ImageFont.truetype(str(fontpath),76); subfont=ImageFont.truetype(str(Path(__file__).resolve().parents[1]/'fonts'/'project-title-subset.ttf'),50)
# Seeded particle paths; shared with Canvas preview.
rng=np.random.default_rng(18)
particles=[[float(rng.uniform(70,890)),float(rng.uniform(85,440)),float(rng.uniform(.6,1.8)),float(rng.uniform(0,6.28))] for _ in range(76)]
def p(t,s,d):return min(1,max(0,(t-s)/d))
def ease(v):return 1-(1-v)**3
def mix(a,b,v):return a+(b-a)*v
y,x=np.mgrid[0:1080,0:1920]; dist=np.hypot(x-384,y)/1600
stops=[(0,(27,49,80)),(.42,(11,18,32)),(1,(7,12,22))]
bg=np.zeros((1080,1920,3),dtype=np.uint8)
for k in range(3):bg[:,:,k]=np.interp(dist,[0,.42,1],[27 if k==0 else 49 if k==1 else 80,(11,18,32)[k],(7,12,22)[k]])
background=Image.fromarray(bg)
# Original synthesized soundtrack: low bed + particles + key construction + scan + unlock + major chord.
a=np.zeros(int(DUR*SR),dtype=np.float64)
def tone(at,dur,f,amp=.06,end=None):
 n=int(dur*SR); ts=np.arange(n)/SR
 phase=2*np.pi*(f*ts if end is None else f*ts+(end-f)*ts**2/(2*dur))
 env=(1-np.exp(-ts*100))*np.exp(-ts/(dur*.33))*np.minimum(1,(dur-ts)/.03)
 sig=np.sin(phase)*env*amp
 start=int(at*SR);a[start:start+n]+=sig[:len(a[start:start+n])]
for f in (130.81,196):tone(.12,5.9,f,.021)
for i in range(9):tone(.25+i*.105,.16,1400+i*60,.009)
for i,f in enumerate([261.63,392,523.25]):tone(1.2+i*.32,.55,f,.055)
tone(2.7,.7,180,.045,360)
for i in range(4):tone(4.35+i*.2,.24,680+i*100,.035)
for i,f in enumerate([783.99,1046.5,1318.5]):tone(5.25+i*.065,.38,f,.065)
for f in (261.63,329.63,392,523.25):tone(6.7,2.35,f,.038)
tone(7.15,.8,659.25,.032)
# Additional synchronized effects: soft digital texture, movement and insertion.
fxrng=np.random.default_rng(42)
def texture(at,dur,amp=.012,carrier=1800):
 n=int(dur*SR);tt=np.arange(n)/SR
 noise=fxrng.normal(0,1,n)
 noise=np.convolve(noise,np.ones(7)/7,mode='same')
 env=np.sin(np.pi*np.minimum(1,tt/dur))**2
 sig=amp*env*(.65*noise+.35*np.sin(2*np.pi*carrier*tt))
 start=int(at*SR);a[start:start+n]+=sig[:len(a[start:start+n])]
texture(.12,1.0,.014)
for i,f in enumerate([1046.5,1318.51,1567.98,2093]):tone(1.23+i*.19,.12,f,.020)
texture(1.15,1.05,.015,2400)
for i in range(3):tone(2.68+i*.1,.16,523.25*(2**(i/12)),.022)
texture(3.55,.78,.024,950)
tone(3.55,.62,240,.020,600)
tone(4.30,.12,150,.07);texture(4.30,.08,.035,1800)
# Turning/scanning ticks follow the ring scan, then a clean unlock click.
for i in range(6):
 tone(4.38+i*.13,.07,1200+i*60,.018)
 texture(4.38+i*.13,.045,.010,1700)
tone(5.25,.12,220,.065);texture(5.25,.09,.026,2600)
for i,f in enumerate([523.25,659.25,783.99]):tone(5.46+i*.07,.5,f,.030)
texture(5.9,.75,.013,2200)
for i,f in enumerate([1046.5,1318.51,1567.98]):tone(6.05+i*.17,.22,f,.026)
tone(7.0,.32,1046.5,.028);tone(7.45,.35,1318.51,.026)
fade=np.clip((DUR-np.arange(len(a))/SR)/.65,0,1);a*=fade
pcm=(np.clip(a,-.95,.95)*32767).astype('<i2')
wav=D.parent/'audio'/'welcome.wav'
with wave.open(str(wav),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())

def frame(t):
 layer=Image.new('RGBA',(1920,1080));dr=ImageDraw.Draw(layer)
 fade=1
 def col(c,alpha=1):return (*c,int(255*max(0,min(1,alpha*fade))))
 def line(points,c=C,w=1.5,alpha=1):dr.line([(int(xx*2),int(yy*2)) for xx,yy in points],fill=col(c,alpha),width=max(1,int(w*2)),joint='curve')
 def arc(cx,cy,r,start,end,c=C,w=1.5,alpha=1):
  pts=[(cx+math.cos(v)*r,cy+math.sin(v)*r) for v in np.linspace(start,end,max(2,int(abs(end-start)*r/3)))];line(pts,c,w,alpha)
 def rr(cx,cy,w,h,r,c=C,lw=1.5,alpha=1,fill=None):
  box=((cx-w/2)*2,(cy-h/2)*2,(cx+w/2)*2,(cy+h/2)*2)
  dr.rounded_rectangle(box,radius=r*2,outline=col(c,alpha),width=int(lw*2),fill=col(fill,alpha) if fill else None)
 # Discrete energy guides.
 energy=(1-p(t,6.1,1.0))*.23*p(t,0,.65)
 for yy in (194,248,302):line([(110,yy),(215,yy),(245,yy-18),(680,yy-18),(710,yy),(850,yy)],alpha=energy,w=.7)
 for i,(px,py,r,ph) in enumerate(particles):
  gather=ease(p(t,.45,1.5));xx=mix(px,300+math.cos(ph)*74,gather); yy=mix(py,248+math.sin(ph)*26,gather)
  life=p(t,0,.7)*(1-p(t,1.85,.65));alpha=life*(.25+.5*(.5+.5*math.sin(t*3+ph)))
  dr.ellipse(((xx-r)*2,(yy-r)*2,(xx+r)*2,(yy+r)*2),fill=col(C,alpha))
 morph=ease(p(t,6.05,.85));cx=mix(595,315,morph);cy=mix(248,255,morph);radius=mix(92,100,morph)
 lockalpha=p(t,2.65,.55)
 arc(cx,cy,radius,-math.pi/2,-math.pi/2+2*math.pi*p(t,2.65,.8),w=mix(2,3.5,morph),alpha=lockalpha)
 arc(cx,cy,radius+9,-math.pi*.8,-math.pi*.23,w=.8,alpha=lockalpha*.5)
 arc(cx,cy,radius+9,.18,1.35,w=.8,alpha=lockalpha*.5)
 # Ring tick marks.
 for i in range(16):
  ang=i*math.pi/8;line([(cx+math.cos(ang)*(radius-9),cy+math.sin(ang)*(radius-9)),(cx+math.cos(ang)*(radius-6),cy+math.sin(ang)*(radius-6))],w=.7,alpha=lockalpha*.4)
 opening=ease(p(t,5.25,.55))*(1-morph)
 # Shackle lifts with clear open gap on the right.
 ax=cx-16*opening;ay=cy-11-12*opening
 arc(ax,ay,25,math.pi,2*math.pi,w=3,alpha=lockalpha*(1-morph))
 line([(ax-25,ay),(ax-25,cy+7)],w=3,alpha=lockalpha*(1-morph))
 line([(ax+25,ay),(ax+25,ay+14*(1-opening))],w=3,alpha=lockalpha*(1-morph))
 bodyalpha=lockalpha*(1-morph)
 rr(cx,cy+26,87,54,12,w if False else C,2,bodyalpha,fill=(16,35,51))
 if bodyalpha>0:rr(cx,cy+25,14,14,3,alpha=bodyalpha)
 # Final logo uses the reference padlock: U-shaped shackle and rectangular body.
 finalx=cx+28;finaly=cy-12
 if morph>0:
  rr(finalx,finaly,63,41,4,lw=3,alpha=morph,fill=(16,35,51))
  archy=finaly-29.5
  arc(finalx,archy,19.55,math.pi,2*math.pi,w=3,alpha=morph)
  line([(finalx-19.55,archy),(finalx-19.55,finaly-19.5)],w=3,alpha=morph)
  line([(finalx+19.55,archy),(finalx+19.55,finaly-19.5)],w=3,alpha=morph)
  arc(finalx,finaly-3,3.2,0,2*math.pi,w=1.3,alpha=morph)
  line([(finalx,finaly),(finalx,finaly+6)],w=2,alpha=morph)
 # Recognizable real key: circular bow, long blade, and three cut teeth.
 travel=ease(p(t,3.55,.78));kx=mix(300,548,travel);kx=mix(kx,303,morph);ky=mix(mix(248,274,travel),303,morph);ks=mix(1,.78,morph)
 keylayer=Image.new("RGBA",(1920,1080));dr=ImageDraw.Draw(keylayer)
 keyalpha=p(t,1.15,.4)
 build=p(t,1.15,1.05)
 # Bow is traced first, followed by the blade from left to right.
 hx=kx-48*ks;hy=ky
 arc(hx,hy,30*ks,0,2*math.pi*min(1,build*2),w=3,alpha=keyalpha)
 if build>.22:arc(hx-11*ks,hy,8*ks,0,2*math.pi*p(build,.22,.25),w=2,alpha=keyalpha*.8)
 blade=[(-25,-11),(-18,-11),(-18,-9),(57,-9),(65,-1),(57,10),(49,10),(44,6),(39,10),(34,6),(29,10),(24,6),(19,10),(14,6),(9,10),(4,6),(-1,10),(-6,10),(-6,13),(-18,13),(-18,11),(-25,11)]
 pts=[(kx+xx*ks,ky-yy*ks) for xx,yy in blade]
 pts.append(pts[0])
 reveal=p(build,.40,.60)
 lengths=[math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]) for i in range(len(pts)-1)]
 remaining=sum(lengths)*reveal
 for i,length in enumerate(lengths):
  if remaining<=0:break
  fraction=min(1,remaining/max(length,.001))
  endpoint=(mix(pts[i][0],pts[i+1][0],fraction),mix(pts[i][1],pts[i+1][1],fraction))
  line([pts[i],endpoint],w=3,alpha=keyalpha)
  remaining-=length
 if build>.8:line([(kx-15*ks,ky),(kx+54*ks,ky)],w=.8,alpha=keyalpha*.45*p(build,.8,.2))
 # Scanning light follows the key's construction.
 if t<2.3 and build>0:line([(kx-80*ks+166*ks*build,ky-35*ks),(kx-80*ks+166*ks*build,ky+35*ks)],w=1.3,alpha=(1-p(t,2.1,.2))*.65)
 # Blade disappears behind the left face of the lock as it slides in.
 # Keep the bow outside; reveal the complete key only during logo formation.
 if travel>0:
  alpha=keylayer.getchannel('A')
  cutoff=int((cx-43.5)*2)
  hidden=alpha.crop((cutoff,0,1920,1080)).point(lambda value:int(value*morph))
  alpha.paste(hidden,(cutoff,0));keylayer.putalpha(alpha)
 layer.alpha_composite(keylayer);dr=ImageDraw.Draw(layer)
 # Small entrance slot clarifies where the key enters the lock.
 if travel>0 and morph<1:
  line([(cx-43.5,cy+19),(cx-43.5,cy+33)],c=WHITE,w=2.2,alpha=travel*(1-morph)*.65)
 # scan and restrained expanding unlock pulses.
 if 4.3<=t<5.25:
  ang=(t-4.3)*math.pi*2;arc(cx,cy,radius-17,ang-.7,ang+.4,w=3,alpha=.8)
 for start in (5.25,5.46):
  v=p(t,start,.72)
  if 0<v<1:arc(cx,cy,radius+v*58,0,math.pi*2,GREEN,1.8,1-v)
 # Small successful energy indicator; final logo retains lock + toothed key.
 if t>=5.25:dr.ellipse(((cx+radius*.61-3)*2,(cy-radius*.66-3)*2,(cx+radius*.61+3)*2,(cy-radius*.66+3)*2),fill=col(GREEN,p(t,5.25,.25)))
 # Final desktop composition: logo, vertical divider, welcome text.
 div=p(t,6.85,.55);height=210*ease(div)
 line([(465,255-height/2),(465,255+height/2)],c=WHITE,w=1,alpha=div*.42)
 for text,yy,f,start,color in [('歡迎使用 iKey',247,font,7.55,WHITE),('自動多場景智慧鎖',293,subfont,8.15,(166,178,197))]:
  v=p(t,start,.6)
  if v<=0:continue  # Invisible glyphs must not erase previously drawn outlines.
  dr.text((515*2,(yy+10*(1-v))*2),text,font=f,fill=col(color,v),anchor='ls')
 # Minimal bloom keeps lines sharp.
 glow=layer.filter(ImageFilter.GaussianBlur(7));glow.putalpha(glow.getchannel('A').point(lambda v:int(v*.28)))
 im=background.copy().convert('RGBA');im.alpha_composite(glow);im.alpha_composite(layer);return im.convert('RGB')

print('Audio generated; rendering 588 frames',flush=True)
cmd=['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s','1920x1080','-r','60','-i','pipe:0','-i',str(wav),'-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart','-t',str(DUR),str(D/'welcome-preview.mp4')]
proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
for i in range(round(DUR*FPS)):
 im=frame(i/FPS);proc.stdin.write(im.tobytes())
 if i in (138,246,300,486):im.save(D.parent/'frames'/f'frame-{i:03d}.png')
 if i%120==0:print(f'Rendered {i}/{round(DUR*FPS)}',flush=True)
proc.stdin.close();rc=proc.wait();assert rc==0
print('Video complete',flush=True)
# Source data for matching HTML renderer.

