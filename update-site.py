from pathlib import Path
p=Path(__file__).parent/'dist/index.html'
s=p.read_text()
s=s.replace('<script src="app.js" defer></script>','<script src="content.js" defer></script><script src="app.js" defer></script>')
s=s.replace('I’m a hairstylist in Logan, Utah, at The Hair Studio Salon & Spa. Blondes, brunettes, lived-in colors, and extensions are my thing.','I’m Halli Miller, a hairstylist at The Hair Studio Salon & Spa in Logan, Utah. I’m from a small town in Washington, but Utah feels like my second home. I trained at Paul Mitchell in Logan, and I love all things hair — especially foil work!')
s=s.replace('I love getting to meet new faces and helping you feel your best. Whether you’re ready for a change or just a little refresh, I’d love to see you in my chair.','Outside the salon, you’ll find me crafting, shopping, or trying something new — whether that’s a new restaurant around the corner or a fun little hike. I love helping people find a look they feel great in, and I can’t wait to see you in my chair!')
s=s.replace('Halli x</div>','Halli Miller</div>')
s=s.replace('<p class="eyebrow">A LITTLE TIME FOR YOU</p><h2>Meet me<br><em>in the chair.</em></h2><p>Good hair. A fresh start. A moment that’s yours.</p>','<p class="eyebrow">LET’S STAY CONNECTED</p><h2>A little hair.<br><em>A little life.</em></h2><p>Follow along for fresh hair, favorite transformations, and a little of life behind the chair.</p><div class="social-links"><a href="https://www.instagram.com/hairby.hallij/" target="_blank" rel="noopener"><span>Instagram</span><span>↗</span></a><a class="tiktok-link" href="" target="_blank" rel="noopener" aria-disabled="true"><span>TikTok</span><span>Profile coming soon</span></a></div>')
s=s.replace('Hair by Halli J</div></footer>','Hair by Halli J <a class="admin-entry" href="/admin" aria-label="Admin login">Admin</a></div></footer>')
s=s.replace('class="gallery"','class="gallery" data-collection="gallery"').replace('class="steps"','class="steps" data-collection="steps"')
for t in ['color','extensions','cuts']:
 s=s.replace('id="panel-'+t+'"','data-collection="'+t+'" id="panel-'+t+'"')
s=s.replace('<div><details><summary>','<div data-collection="faqs"><details><summary>')
p.write_text(s)
