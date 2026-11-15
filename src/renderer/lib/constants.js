// View constants: hotspot metrics, navigation, severity and dependency status maps.
// Extracted verbatim from the prototype (docs/References/Ombuto Codebase Insight prototype,
// "Codebase Insight.dc.html"). See docs/Architecture/prototype-port.md.
export const METRICS=[
 {id:'cxc',label:'Churn × Complexity',val:f=>Math.sqrt(f.churn*f.cx/2928),fmt:f=>(f.churn*f.cx).toLocaleString(),lo:'low',hi:'high risk'},
 {id:'churn',label:'Churn',val:f=>f.churn/48,fmt:f=>f.churn+' commits',lo:'stable',hi:'frequent'},
 {id:'cx',label:'Complexity',val:f=>f.cx/61,fmt:f=>'cc '+f.cx,lo:'simple',hi:'complex'},
 {id:'age',label:'Code Age',val:f=>f.age/36,fmt:f=>f.age+' mo',lo:'new',hi:'old'},
 {id:'own',label:'Ownership',val:f=>(f.own-30)/65,fmt:f=>f.own+'% one author',lo:'shared',hi:'siloed'},{id:'bugs',label:'Bug Fixes',val:f=>f.bugs/14,fmt:f=>f.bugs+' fixes',lo:'few',hi:'bug-prone'}];
export const NAV=[{id:'overview',label:'Overview',icon:'view-dashboard-outline',g:'a'},{id:'inventory',label:'Size & Inventory',icon:'format-list-numbered',g:'a'},{id:'architecture',label:'Architecture',icon:'graph-outline',g:'a'},{id:'complexity',label:'Complexity',icon:'chart-histogram',g:'a'},{id:'quality',label:'Code Quality',icon:'stethoscope',g:'a'},{id:'deps',label:'Dependencies',icon:'package-variant-closed',g:'a'},{id:'hotspots',label:'Hotspots',icon:'fire',g:'h'},{id:'history',label:'Commit History',icon:'source-commit',g:'h'},{id:'ask',label:'Ask the Codebase',icon:'chat-question-outline',g:'u'},{id:'diagrams',label:'Diagrams',icon:'shape-outline',g:'u'},{id:'file',label:'Files',icon:'file-code-outline',g:'u'},{id:'report',label:'Share Report',icon:'export-variant',g:'s'}].map((n,i)=>({...n,key:i<9?String(i+1):'',hint:i<9?'⌘'+(i+1):''}));
export const SEV={critical:{tone:'red',fg:'var(--om-danger)',icon:'mdi-alert-octagon',rank:3,label:'CRITICAL'},warning:{tone:'yellow',fg:'var(--om-warning)',icon:'mdi-alert',rank:2,label:'WARNING'},info:{tone:'blue',fg:'var(--om-blue)',icon:'mdi-information-outline',rank:1,label:'INFO'}};
export const VSEV={critical:'critical',high:'warning',medium:'warning',low:'info'};
export const STAT={major:{tone:'orange',l:'Major behind',r:3},minor:{tone:'yellow',l:'Minor behind',r:2},patch:{tone:'blue',l:'Patch behind',r:1},current:{tone:'green',l:'Up to date',r:0},deprecated:{tone:'red',l:'Deprecated',r:4}};
