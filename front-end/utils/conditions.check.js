const assert = require("node:assert/strict");
const { conditionAttachmentType, conditionSummaries, mergeConditions } = require("./conditions.cjs");

const detailed = [
    { id: "1", category: "Allergy", title: "Egg" },
    { id: "2", category: "Illness", title: "Cold" },
    { id: "3", category: "Hereditary Condition", title: "Asthma" },
];
const merged = mergeConditions(detailed, [" egg ", "Penicillin"], ["Asthma", "Hypertension"]);
assert.deepEqual(merged.map((item) => item.title), ["Egg", "Cold", "Asthma", "Penicillin", "Hypertension"]);
assert.equal(merged.filter((item) => item.legacy).length, 2);
assert.deepEqual(conditionSummaries(detailed, ["Penicillin"], ["Asthma"]).allergies, ["Egg", "Penicillin"]);
assert.equal(conditionAttachmentType("Allergy"), "allergy");
assert.equal(conditionAttachmentType("Hereditary Condition"), "hereditary");
assert.equal(conditionAttachmentType("Hospitalization"), "hospitalization");
assert.equal(conditionAttachmentType("Illness"), "illness");
console.log("Condition merge checks passed");

const { conditionsSummary, conditionSavedStatus } = require("./conditions.cjs");
const saved=[
 {id:"1",category:"Allergy",title:"No known drug allergies",resolved:false},
 {id:"2",category:"Illness",title:"Hand, Foot and Mouth Disease",resolved:true},
 {id:"3",category:"Illness",title:"Roseola",resolved:true},
 {id:"4",category:"Hereditary Condition",title:"Hypertension (maternal grandmother)",resolved:false},
];
const original=JSON.stringify(saved);const summary=conditionsSummary(saved,["No known drug allergies"],["Hypertension (maternal grandmother)"]);
assert.deepEqual(summary.counts,{all:4,Illness:2,Allergy:1,"Hereditary Condition":1});assert.deepEqual(summary.records,saved);
assert.equal(conditionSavedStatus(saved[0]),"Active");assert.equal(conditionSavedStatus(saved[1]),"Better");assert.equal(conditionSavedStatus({...saved[0],legacy:true}),"Not recorded");assert.equal(conditionSavedStatus({category:"Illness"}),"Not recorded");
assert.deepEqual(conditionsSummary().counts,{all:0,Illness:0,Allergy:0,"Hereditary Condition":0});
assert.equal(conditionsSummary([...saved,{id:"5",category:"Medication"},{id:"6",category:"Hospitalization"}]).counts.all,4);
assert.equal(conditionsSummary([...saved,{id:"7",category:"Allergy",title:"Saved new information"}]).counts.Allergy,2);
assert.equal(conditionsSummary(saved.map(row=>row.id==="2"?{...row,category:"Allergy"}:row)).counts.Illness,1);
assert.equal(conditionsSummary(saved.filter(row=>row.id!=="1")).counts.Allergy,0);
assert.equal(JSON.stringify(saved),original);console.log("Condition metrics/status checks passed");

const store = require("./recordStore.cjs");store.reset();
const readStored = child => conditionsSummary(store.getRows(child,"medical-history"));
store.acceptFetch("a","medical-history",saved,store.startFetch("a","medical-history"));
store.confirm("a","medical-history",{id:"5",category:"Illness",title:"New saved record",resolved:false},"5");assert.equal(readStored("a").counts.Illness,3);
store.confirm("a","medical-history",{id:"5",category:"Illness",title:"Updated saved record",resolved:true},"5");assert.equal(conditionSavedStatus(readStored("a").records[0]),"Better");
store.confirm("a","medical-history",null,"5",true);assert.equal(readStored("a").counts.all,4);
store.acceptFetch("b","medical-history",[],store.startFetch("b","medical-history"));assert.equal(readStored("b").counts.all,0);assert.equal(readStored("a").counts.all,4);store.reset();
console.log("Condition shared-store checks passed: create/edit/delete and child isolation");
