import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { EXPERIENCE, PROFILE } from '../src/experience.js';
import { CONTENT } from '../src/ui/content.js';
import { EXHIBIT_LAYOUT } from '../src/world/experienceGallery.js';

test('every experience exhibit has local imagery and a navigable detail chapter', async () => {
  assert.equal(EXPERIENCE.length,6);
  assert.equal(new Set(EXPERIENCE.map(e=>e.id)).size,6);
  for(const e of EXPERIENCE) {
    for(const path of new Set([e.image,e.logo].filter(Boolean))) {
      await access(`public${path}`);
      const data=await readFile(`public${path}`);
      assert.ok(data.length>1000);
      assert.ok(!data.subarray(0,100).toString().toLowerCase().includes('<!doctype html'));
    }
    assert.ok(CONTENT[`experience-${e.id}`].includes(e.role));
    assert.ok(CONTENT.projects.includes(`data-experience="experience-${e.id}"`));
    assert.ok(EXHIBIT_LAYOUT.some(p=>p.experience.id===e.id));
  }
  assert.equal(EXPERIENCE.find(e=>e.id==='sparks').phases.length,2);
  assert.ok(CONTENT.contact.includes(PROFILE.email));
});
