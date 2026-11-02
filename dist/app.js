const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('#navigation');
function closeMenu() { nav.classList.remove('open'); menuButton.setAttribute('aria-expanded','false'); menuButton.setAttribute('aria-label','Open navigation'); }
menuButton.addEventListener('click', () => { const open = nav.classList.toggle('open'); menuButton.setAttribute('aria-expanded',String(open)); menuButton.setAttribute('aria-label',open?'Close navigation':'Open navigation'); });
nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));
document.addEventListener('keydown', event=>{ if(event.key==='Escape') closeMenu(); });
const tabs = [...document.querySelectorAll('[role="tab"]')];
function selectTab(tab) { tabs.forEach(item=>{ const selected=item===tab; item.setAttribute('aria-selected',String(selected)); item.tabIndex=selected?0:-1; document.getElementById(item.getAttribute('aria-controls')).hidden=!selected; }); }
tabs.forEach((tab,index)=>{ tab.addEventListener('click',()=>selectTab(tab)); tab.addEventListener('keydown',event=>{ let next; if(event.key==='ArrowRight') next=(index+1)%tabs.length; if(event.key==='ArrowLeft') next=(index+tabs.length-1)%tabs.length; if(event.key==='Home') next=0; if(event.key==='End') next=tabs.length-1; if(next!==undefined){event.preventDefault();selectTab(tabs[next]);tabs[next].focus();} }); });
const lightbox=document.querySelector('#lightbox');
document.querySelector('.gallery').addEventListener('click',event=>{const item=event.target.closest('.gallery-item');if(!item)return;document.querySelector('#lightbox-photo').src=item.querySelector('img').src;document.querySelector('#lightbox-photo').alt=item.querySelector('img').alt;document.querySelector('#lightbox-title').textContent=item.dataset.caption;document.querySelector('#lightbox-source').href=item.dataset.url||`https://www.instagram.com/hairby.hallij/p/${item.dataset.post}/`;lightbox.showModal();document.body.style.overflow='hidden';});
lightbox.querySelector('button').addEventListener('click',()=>lightbox.close());
lightbox.addEventListener('click',event=>{if(event.target===lightbox){const r=lightbox.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)lightbox.close();}});
lightbox.addEventListener('close',()=>document.body.style.overflow='');
document.querySelector('#year').textContent=new Date().getFullYear();
