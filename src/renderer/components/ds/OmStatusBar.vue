<script setup>
// Ombuto Code Design System StatusBar (port of the DS bundle's React StatusBar).
const props = defineProps({
  path: { type: String, default: '' },
  branch: { type: String, default: '' },
  modified: { type: Number, default: 0 },
  untracked: { type: Number, default: 0 },
  ahead: { type: Number, default: 0 },
  project: { type: String, default: '' },
  build: { type: String, default: '' },
});
const clean = () => !props.modified && !props.untracked && !props.ahead;
</script>

<template>
  <div class="om-statusbar">
    <span class="om-sb-mono" style="font-size:.7rem;color:rgba(255,255,255,.6);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ path }}</span>
    <span v-if="branch" style="display:flex;align-items:center;gap:.3rem">
      <span class="mdi mdi-source-branch" style="font-size:.85rem;color:rgba(255,255,255,.4)"></span>
      <span class="om-sb-mono" style="font-size:.68rem;color:rgba(255,255,255,.6)">{{ branch }}</span>
      <span v-if="modified > 0" class="om-git-badge" style="background:rgba(229,168,48,.2);color:#e5a830">{{ modified }}M</span>
      <span v-if="untracked > 0" class="om-git-badge" style="background:rgba(91,155,213,.2);color:#5b9bd5">{{ untracked }}?</span>
      <span v-if="ahead > 0" class="om-git-badge" style="background:rgba(109,212,160,.2);color:#6dd4a0">↑{{ ahead }}</span>
      <span v-if="clean()" style="font-size:.68rem;color:rgba(109,212,160,.6)">✓</span>
    </span>
    <span v-if="project" style="position:absolute;left:50%;transform:translateX(-50%);font-size:.7rem;font-weight:500;color:#fff">{{ project }}</span>
    <span class="om-sb-mono" style="font-size:.65rem;color:rgba(255,255,255,.45)">{{ build }}</span>
  </div>
</template>
