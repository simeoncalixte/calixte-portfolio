import { SKILL_AREAS } from '../world/skillsIsland.js';
import { EXPERIENCE, PROFILE, SKILL_GROUPS } from '../experience.js';
import { INTEREST_VERTICALS } from '../interests.js';

const tags = (items) => `<div class="tags">${items.map(t=>`<span class="tag">${t}</span>`).join('')}</div>`;
const image = (e) => `<div class="experience-art ${e.darkLogo ? 'dark-art' : ''} ${e.id === 'xbox' ? 'xbox-art' : ''}"><img src="${e.image}" alt="${e.imageAlt}" />${e.logo && e.logo!==e.image ? `<img class="company-logo" src="${e.logo}" alt="${e.company} logo" />` : ''}</div>`;
const flow = (e) => `<div class="work-flow" aria-label="${e.flow.join(' to ')}">${e.flow.map((step,i)=>`<span><b>0${i+1}</b>${step}</span>`).join('<i aria-hidden="true">→</i>')}</div>`;

export const CONTENT = {
  about: `<div class="num">01 — ABOUT</div><h2>Hi, I'm Calixte.</h2>
    <p>Software developer, development lead, and instructor. I build across interfaces, APIs, data, and infrastructure, with experience in both small teams and large organizations.</p>
    <div class="career-stats"><div><strong>6</strong><span>Organizations</span></div><div><strong>5</strong><span>Developers led</span></div><div><strong>10</strong><span>Students per class</span></div></div>
    <div class="brand-strip">${EXPERIENCE.filter(e=>e.logo).map(e=>`<span class="${e.darkLogo?'dark-art':''}"><img src="${e.logo}" alt="${e.company}" /></span>`).join('')}</div>
    <p>I value continued learning, thoughtful leadership, and building useful products well.</p>
    <button class="cta" data-experience="projects">EXPLORE MY EXPERIENCE <span>→</span></button>`,
  projects: `<div class="num">02 — EXPERIENCE ISLAND</div><h2>A career you can explore.</h2>
    <p>Six chapters in building, connecting, and teaching software. Select a chapter, or approach its exhibit in the world and press E.</p>
    <div class="experience-grid">${EXPERIENCE.map((e,i)=>`<button class="experience-card" data-experience="experience-${e.id}" style="--chapter-color:${e.color}">
      ${image(e)}<div class="chapter-copy"><span class="chapter-year">0${i+1} / ${e.year}</span><h3>${e.company}</h3><p>${e.focus}</p><span class="chapter-open">EXPLORE CHAPTER ↗</span></div></button>`).join('')}</div>`,
  skills: `<div class="num">03 — SKILLS</div><h2>From interface to infrastructure.</h2><p>Explore the four illuminated workbenches around the core. Each displays my tools in the world; press E nearby to see the related work.</p>
    <div class="skill-grid">${SKILL_GROUPS.map(([name,items],i)=>`<section class="skill-group"><span class="skill-number">0${i+1}</span><h3>${name}</h3>${tags(items)}<button class="skill-explore" data-experience="skills-${SKILL_AREAS[i].id}">EXPLORE THIS AREA →</button></section>`).join('')}</div>`,
  contact: `<div class="num">04 — CONTACT</div><h2>Let's build something useful.</h2><p>Connect with Calixte Simeon.</p>
    <div class="contact-links"><a href="mailto:${PROFILE.email}">Email ↗</a><a href="${PROFILE.github}" target="_blank" rel="noopener">GitHub ↗</a><a href="${PROFILE.linkedin}" target="_blank" rel="noopener">LinkedIn ↗</a></div>
    <form id="contact-form"><input name="name" aria-label="Your name" placeholder="Your name" required /><input name="email" type="email" aria-label="Email" placeholder="Email" required /><textarea name="message" aria-label="Message" placeholder="Message" required></textarea><button class="cta" type="submit">OPEN EMAIL DRAFT <span>→</span></button></form>`,
};

for (const [i,e] of EXPERIENCE.entries()) CONTENT[`experience-${e.id}`] = `
  <button class="chapter-back" data-experience="projects">← ALL CHAPTERS</button>
  <div class="chapter-detail" style="--chapter-color:${e.color}">
    <div class="num">CHAPTER 0${i+1} / ${e.year}</div><h2>${e.title}</h2>
    ${image(e)}<p class="image-credit">${e.caption}. Brand context imagery.</p>
    <div class="chapter-heading"><div><h3>${e.company}</h3><p>${e.role}<br /><span>${e.employer} · ${e.dates}</span></p></div><div class="chapter-metric"><strong>${e.metric}</strong><span>${e.metricLabel}</span></div></div>
    ${e.phases ? `<div class="employment-phases">${e.phases.map(p=>`<span>${p}</span>`).join('')}</div>` : ''}
    <p>${e.summary}</p>${flow(e)}
    <ul class="outcomes">${e.outcomes.map(o=>`<li>${o}</li>`).join('')}</ul>${tags(e.stack)}
    <a class="link source-link" href="${e.source}" target="_blank" rel="noopener">Image source ↗</a>
    <button class="chapter-next" data-experience="experience-${EXPERIENCE[(i+1)%EXPERIENCE.length].id}">NEXT CHAPTER <span>→</span></button>
  </div>`;

for (const area of SKILL_AREAS) CONTENT[`skills-${area.id}`] = `
  <button class="chapter-back" data-experience="skills">← ALL SKILLS</button>
  <div class="skill-detail" style="--skill-color:${area.color}">
    <div class="skill-emblem" aria-hidden="true">${area.symbol}</div>
    <div class="num">SKILLS ISLAND / ${area.title.toUpperCase()}</div>
    <h2>${area.title}</h2><p>${area.description}</p>${tags(area.skills)}
    <h3 class="related-heading">Applied in the real world</h3>
    <div class="cards">${area.examples.map(id=>EXPERIENCE.find(e=>e.id===id)).map(e=>`
      <button class="skill-work" data-experience="experience-${e.id}">
        <span>${e.company}</span><small>${e.focus}</small><b>EXPLORE WORK ↗</b>
      </button>`).join('')}</div>
  </div>`;

for (const area of INTEREST_VERTICALS) CONTENT[`interest-${area.id}`] = `
  <div class="num">05 — INTEREST ISLAND / AREAS OF INTEREST</div>
  <h2>${area.title}</h2><p>${area.description}</p>${tags(area.topics)}
  <h3>What I'd like to explore</h3>
  <ul class="outcomes">${area.ideas.map(idea=>`<li>${idea}</li>`).join('')}</ul>
  ${area.id==='education'?'<button class="cta" data-experience="experience-geeks">EXPLORE MY TEACHING EXPERIENCE <span>→</span></button>':''}
  <p class="image-credit">3D model: <a href="${area.source}" target="_blank" rel="noopener">${area.modelName} by ${area.author}</a> · <a href="${area.licenseUrl || 'https://creativecommons.org/licenses/by/3.0/'}" target="_blank" rel="noopener">${area.license || 'CC BY 3.0'}</a>. Display scale and placement adjusted.</p>`;
