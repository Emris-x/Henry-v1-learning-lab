import './style.css';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = (s, root=document) => root.querySelector(s);
const uid = () => crypto.randomUUID();
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem('henry-v1-'+key)) ?? fallback; } catch { return fallback; } };
let user = null;
let projects = read('projects', []);
let activeId = read('active-project', null);
let mode = 'Explore';
let messagesByProject = read('messages', {});
let authMode = 'signin';
let busy = false;

const escapeHtml = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const persist = () => {
  localStorage.setItem('henry-v1-projects', JSON.stringify(projects));
  localStorage.setItem('henry-v1-active-project', JSON.stringify(activeId));
  localStorage.setItem('henry-v1-messages', JSON.stringify(messagesByProject));
};
const activeProject = () => projects.find(p => p.id === activeId) || null;
const setStatus = text => { const el = $('#status'); if (el) el.textContent = text; };

async function refreshUser() {
  const { data } = await supabase.auth.getSession();
  user = data.session?.user ?? null;
  supabase.auth.onAuthStateChange((_event, session) => { user = session?.user ?? null; render(); });
}
function newProject(title='Untitled engineering project', goal='') {
  const project = { id: uid(), title, goal, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  projects.unshift(project);
  activeId = project.id;
  messagesByProject[project.id] = [];
  persist(); render();
}
function openAuth(mode='signin') {
  authMode = mode;
  const overlay = $('#auth-overlay');
  overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><button class="icon-button close" id="auth-close" aria-label="Close">×</button><div class="brand-mark">H</div><p class="eyebrow">HENRY ACCOUNT</p><h2>${mode==='signup'?'Create your account':'Welcome back'}</h2><p class="muted-text">Sign in to prepare your workspace for cloud sync.</p><form id="auth-form"><label>Email<input name="email" type="email" autocomplete="email" required maxlength="254"></label><label>Password<input name="password" type="password" autocomplete="${mode==='signup'?'new-password':'current-password'}" required minlength="6"></label><button class="primary full" type="submit">${mode==='signup'?'Create account':'Sign in'}</button><p id="auth-feedback" class="feedback" aria-live="polite"></p></form><button class="text-button" id="auth-switch">${mode==='signup'?'Already have an account? Sign in':'New to Henry? Create an account'}</button></div>`;
  overlay.hidden = false;
  $('#auth-close').onclick = () => overlay.hidden = true;
  $('#auth-switch').onclick = () => openAuth(mode==='signup'?'signin':'signup');
  $('#auth-form').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget), email = fd.get('email'), password = fd.get('password');
    const feedback = $('#auth-feedback'); feedback.textContent = 'Connecting securely…';
    const result = mode==='signup'
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) { feedback.textContent = result.error.message; return; }
    if (mode==='signup' && !result.data.session) feedback.textContent = 'Account created. Check your email to confirm it, then sign in.';
    else { user = result.data.user ?? result.data.session?.user ?? null; overlay.hidden = true; render(); }
  };
}
function render() {
  const project = activeProject();
  const messages = project ? (messagesByProject[project.id] || []) : [];
  $('#app').innerHTML = `
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">H</div><div><strong>HENRY</strong><small>ENGINEERING INTELLIGENCE</small></div></div>
      <button class="new-project" id="new-project"><span>＋</span> New project</button>
      <p class="section-label">YOUR WORKSPACE</p>
      <div class="project-list">${projects.length ? projects.map(p=>`<button class="project-link ${p.id===activeId?'selected':''}" data-project="${p.id}"><span class="project-glyph">◈</span><span>${escapeHtml(p.title)}</span></button>`).join('') : '<p class="sidebar-empty">Your projects will appear here.</p>'}</div>
      <div class="sidebar-bottom"><div class="engine-state"><span class="state-dot"></span><div><strong>AI engine</strong><small>Not connected yet</small></div></div><button id="account-button" class="account-button"><span class="avatar">${user?escapeHtml((user.email||'U')[0].toUpperCase()):'G'}</span><span><strong>${user?escapeHtml(user.email):'Guest workspace'}</strong><small>${user?'Signed in':'Sign in to your account'}</small></span><span class="more">···</span></button></div>
    </aside>
    <main class="main">
      <header class="topbar"><div class="crumb"><span>Workspace</span><span class="slash">/</span><strong>${project?escapeHtml(project.title):'Overview'}</strong></div><div class="top-actions"><span class="connection"><i></i> Local workspace</span><button class="avatar small-avatar" id="top-account" aria-label="Account">${user?escapeHtml((user.email||'U')[0].toUpperCase()):'G'}</button></div></header>
      ${project ? `
        <section class="work-area">
          <div class="project-heading"><div><p class="eyebrow">ENGINEERING WORKSPACE</p><h1>${escapeHtml(project.title)}</h1><p class="project-goal">${escapeHtml(project.goal||'Describe your idea and build its foundation here.')}</p></div><button class="quiet-button" id="edit-project">Project details ↗</button></div>
          <div class="mode-row"><span class="mode-label">WORKING MODE</span>${['Explore','Teach','Build'].map(m=>`<button class="mode-chip ${m===mode?'active':''}" data-mode="${m}">${m==='Explore'?'◉':m==='Teach'?'⌘':'⌁'} &nbsp;${m}</button>`).join('')}<span class="mode-hint">${mode==='Explore'?'Clarify the idea and test assumptions':mode==='Teach'?'Learn concepts step by step':'Plan and work through implementation'}</span></div>
          <div class="chat-panel">
            <div class="conversation" id="conversation">
              ${messages.length ? messages.map(m=>`<article class="message ${m.role==='user'?'user-message':'assistant-message'}"><div class="message-avatar">${m.role==='user'?'YOU':'H'}</div><div class="message-content"><div class="message-author">${m.role==='user'?'You':'Henry'} <span>${escapeHtml(m.mode||'')}</span></div><p>${escapeHtml(m.content).replace(/\n/g,'<br>')}</p></div></article>`).join('') : `<div class="welcome"><div class="welcome-symbol">H</div><p class="eyebrow">IDEA → UNDERSTANDING → REALITY</p><h2>What are we building?</h2><p>Start with an idea, a problem, or a question. We'll establish the foundations before rushing into code.</p><div class="starter-prompts"><button data-prompt="Help me refine my idea and identify the biggest unanswered questions.">Refine my idea <span>↗</span></button><button data-prompt="Teach me the core concepts I need to understand before building this.">Teach me the foundations <span>↗</span></button><button data-prompt="Help me turn this idea into a practical engineering plan.">Create an engineering plan <span>↗</span></button></div><p class="engine-notice"><span class="state-dot"></span> AI responses are not active yet. Your messages can be drafted here, but Henry will not pretend to answer until an engine is connected.</p></div>`}
            </div>
            <form class="composer" id="composer"><textarea id="message-input" rows="2" maxlength="8000" placeholder="Describe your idea or ask an engineering question…" ${busy?'disabled':''}></textarea><div class="composer-bottom"><span>Enter to send · Shift + Enter for a new line</span><button class="send-button" type="submit" ${busy?'disabled':''}>Send <span>↑</span></button></div></form>
          </div>
          <p class="privacy-note">Your current project and conversation are saved in this browser. Cloud conversation sync will be added after the data model is in place.</p>
        </section>
      ` : `
        <section class="overview">
          <div class="hero"><div><p class="eyebrow">YOUR ENGINEERING SPACE</p><h1>Ideas deserve<br><em>to become real.</em></h1><p>Think clearly. Learn deeply. Build with purpose.</p></div><button class="primary" id="hero-new">＋ Start a project</button></div>
          <div class="overview-grid"><article class="overview-card"><span class="card-icon">◉</span><p class="eyebrow">01 / EXPLORE</p><h2>Establish the idea.</h2><p>Clarify the problem, assumptions, requirements, and what success means.</p></article><article class="overview-card"><span class="card-icon">⌘</span><p class="eyebrow">02 / TEACH</p><h2>Understand the why.</h2><p>Learn the concepts and terminology behind the engineering decisions.</p></article><article class="overview-card"><span class="card-icon">⌁</span><p class="eyebrow">03 / BUILD</p><h2>Move toward reality.</h2><p>Turn sound foundations into a practical implementation plan.</p></article></div>
          <div class="projects-heading"><div><p class="eyebrow">PROJECTS</p><h2>Your work, in one place</h2></div><span class="project-count">${projects.length} ${projects.length===1?'project':'projects'}</span></div>
          <div class="project-grid">${projects.length?projects.map(p=>`<button class="project-card" data-project="${p.id}"><span class="card-icon">◈</span><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.goal||'No project brief yet.')}</p><span class="open-project">Open workspace ↗</span></button>`).join(''):'<div class="empty-projects"><div class="empty-mark">＋</div><strong>Your first project starts with an idea.</strong><p>Create a workspace to organise your thinking and engineering decisions.</p><button class="secondary" id="empty-new">Create your first project</button></div>'}</div>
          <div class="build-notice"><div><span class="state-dot"></span><strong>Foundation stage</strong></div><p>Project workspaces are being established first. The online AI engine and cloud conversation storage will be connected in the next implementation steps.</p></div>
        </section>
      `}
    </main>
    <div id="auth-overlay" class="overlay" hidden></div><div id="project-overlay" class="overlay" hidden></div>
  `;
  $('#new-project').onclick = showProjectForm;
  $('#hero-new')?.addEventListener('click', showProjectForm);
  $('#empty-new')?.addEventListener('click', showProjectForm);
  document.querySelectorAll('[data-project]').forEach(b=>b.addEventListener('click',()=>{activeId=b.dataset.project;persist();render()}));
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;render()}));
  document.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>{ $('#message-input').value=b.dataset.prompt; $('#message-input').focus(); }));
  $('#account-button').onclick = () => user ? showAccountMenu() : openAuth('signin');
  $('#top-account').onclick = () => user ? showAccountMenu() : openAuth('signin');
  $('#edit-project')?.addEventListener('click',()=>showProjectForm(project));
  $('#composer')?.addEventListener('submit', e=>{e.preventDefault(); const text=$('#message-input').value.trim(); if(!text||!project)return; messagesByProject[project.id] ||= []; messagesByProject[project.id].push({id:uid(),role:'user',content:text,mode,createdAt:new Date().toISOString()}); project.updatedAt=new Date().toISOString(); persist(); render();});
  $('#message-input')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#composer').requestSubmit()}});
  const conversation=$('#conversation'); if(conversation) conversation.scrollTop=conversation.scrollHeight;
}
function showAccountMenu() {
  const overlay=$('#auth-overlay'); overlay.innerHTML=`<div class="modal"><button class="icon-button close" id="menu-close">×</button><div class="brand-mark">${escapeHtml((user?.email||'U')[0].toUpperCase())}</div><h2>Account</h2><p class="muted-text">${escapeHtml(user?.email||'')}</p><p class="muted-text">Cloud sync is not enabled for project conversations yet.</p><button class="secondary full" id="signout">Sign out</button></div>`; overlay.hidden=false; $('#menu-close').onclick=()=>overlay.hidden=true; $('#signout').onclick=async()=>{await supabase.auth.signOut();user=null;overlay.hidden=true;render()};
}
function showProjectForm(project=null) {
  const overlay=$('#project-overlay'); overlay.innerHTML=`<div class="modal"><button class="icon-button close" id="project-close">×</button><p class="eyebrow">PROJECT SETUP</p><h2>${project?'Project details':'Start with the idea'}</h2><p class="muted-text">You don't need a perfect specification. Begin with what you know.</p><form id="project-form"><label>Project name<input name="title" maxlength="100" required placeholder="e.g. Smart greenhouse assistant" value="${escapeHtml(project?.title||'')}"></label><label>What do you want to build?<textarea name="goal" rows="4" maxlength="2000" placeholder="Describe the problem, idea, or outcome you want…">${escapeHtml(project?.goal||'')}</textarea></label><button class="primary full" type="submit">${project?'Save changes':'Create project'}</button></form></div>`; overlay.hidden=false; $('#project-close').onclick=()=>overlay.hidden=true; $('#project-form').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const title=String(fd.get('title')).trim();const goal=String(fd.get('goal')).trim();if(project){project.title=title;project.goal=goal;project.updatedAt=new Date().toISOString();activeId=project.id;}else{newProject(title,goal);overlay.hidden=true;return;}persist();overlay.hidden=true;render();};
}
refreshUser().then(render);
