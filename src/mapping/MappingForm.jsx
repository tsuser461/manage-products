import { Button } from "@mui/material";
import { CreateFamilyDialog } from "../products/FamilyFields";
import { FieldLabel, Section, useDb, useUi } from "../components/common";
import { CATEGORY_BY_ACTIVITY_TYPE, ACTIVITY_TYPES, CODES_BY_TYPE, FIXED_FAMILY, MAPPING_TYPES, SYSTEM_CODES } from "../constants";
import { PickerField, SelectField } from "../components/PickerField";
import { useEffect, useState } from "react";
import { RemovedSchedulePreview, UndoNote } from "../components/previews";
import { byUnit, groupsOf, isSystem, nowStamp, ownershipLabels, productTextList, toggle, withAdded, without } from "../lib/utils";
import { activityRowId, activityRows, pruneSchedule, validateFamily, withTabDots } from "../lib/domain";
import { snap, useInitialSnapshot } from "../components/EditGrid";
import { useDeleteMapping } from "./useDeleteMapping";

export function MappingForm({ editingId, prefill, fromTab, dirtyRef, onDone, onDiscard }) {
  const { db, setDb } = useDb();
  const { confirm, notify, openSchedule } = useUi();
  const deleteMapping = useDeleteMapping();
  const m = editingId ? db.mappings.find((x) => x.id === editingId) : null;
  // EVAC, AL and AR are system Mappings: the form opens so they can be viewed, with every field and Update / Delete disabled.
  const readOnly = !!m && isSystem(m);
  const [type, setTypeRaw] = useState(m ? m.type : (prefill && prefill.type) || "");
  // T/X has a single Code (Default), so its Code field stays empty and disabled and Default is implied.
  const [code, setCodeRaw] = useState(m ? (m.type === "T/X" ? "" : m.code) : prefill && prefill.type === "O" ? "Default" : prefill && prefill.type === "X" ? "PREP" : "");
  const [pt, setPt] = useState(m ? m.activityType || "" : "");
  const [category, setCategory] = useState(m ? [...(m.category || [])] : []);
  const [links, setLinks] = useState(() => {
    const l = {};
    if (m && m.type === "O")
      groupsOf(m).forEach((p) => {
        l[p] = [...((m.links || {})[p] || [])];
      });
    return l;
  });
  const [tFam, setTFam] = useState(m && m.type === "T/X" && m.code === "Default" ? [...m.families] : []);
  const [xFam, setXFam] = useState(m && m.type === "X" ? [...m.families] : []); // the single Product Family of X - PREP
  const [drafts, setDrafts] = useState([]);
  const [errors, setErrors] = useState({});
  const initialMapping = useInitialSnapshot({ type, code, pt, category, links, tFam, xFam });
  const mappingChanged = snap({ type, code, pt, category, links, tFam, xFam }) !== initialMapping;
  const clearError = (...keys) =>
    setErrors((e) => {
      if (!keys.some((k) => e[k])) return e;
      const n = { ...e };
      keys.forEach((k) => delete n[k]);
      return n;
    });
  const [createCtx, setCreateCtx] = useState(null);
  useEffect(() => {
    dirtyRef.current = false;
  }, []);
  const dirty = () => {
    dirtyRef.current = true;
  };
  const allFamilies = [...db.families, ...drafts];
  const familyNames = allFamilies.map((f) => f.name).sort((a, b) => a.localeCompare(b));
  const productsOf = (name) => productTextList((allFamilies.find((f) => f.name === name) || { products: [] }).products);
  // Which form this Mapping is: O · Default (Product Families per Category, scheduled), O · EVAC / AL / AR (system, Products per Category), T/X · Default (Product Families, scheduled) or X · PREP (one Product Family).
  const isDefaultO = type === "O" && code === "Default";
  const isSys = type === "O" && SYSTEM_CODES.includes(code);
  const effCode = type === "T/X" ? "Default" : code; // the Code that is saved
  const isTxDefault = type === "T/X";
  const isPrep = type === "X" && code === "PREP";
  // One Mapping each for T/X Default, X · PREP, O · EVAC, O · AL and O · AR; O · Default can have many. A Code already mapped shows "Mapped" and is disabled.
  // EVAC, AL and AR are system Mappings, so users never create them.
  const taken = (t, c) => !(t === "O" && c === "Default") && db.mappings.some((x) => x.type === t && x.code === c && x.id !== editingId);
  // T/X and X each have one Code and one Mapping: once it exists, the Type option shows "Mapped" and is disabled (the Mapping being edited does not count).
  const typeTaken = (t) => t !== "O" && (CODES_BY_TYPE[t] || []).every((c) => taken(t, c));
  const codeOption = (c) => {
    const isTaken = taken(type, c);
    const systemCode = type === "O" && SYSTEM_CODES.includes(c);
    return { value: c, label: c, disabled: isTaken || systemCode, hint: isTaken ? "Mapped" : systemCode ? "System Mapping" : "" };
  };
  // Products of EVAC, AL and AR come from FIXED only.
  const fixedProducts = [...((db.families.find((f) => f.name === FIXED_FAMILY) || { products: [] }).products)].sort(byUnit);
  function setType(v) {
    dirty();
    setErrors({});
    setTypeRaw(v);
    // Type O defaults its Code to Default; Type X has one Code, PREP, so it is filled in.
    setCodeRaw(v === "O" ? "Default" : v === "X" ? "PREP" : "");
    setPt("");
    setCategory([]);
    setLinks({});
    setTFam([]);
    setXFam([]);
  }
  function changeCode(v) {
    dirty();
    setErrors({});
    setCodeRaw(v);
    setCategory([]);
    setLinks({});
    setTFam([]);
    setXFam([]);
    setPt(""); // Activity Type is only for O · Default; X · PREP leaves it empty and disabled
  }
  // Selected Categories that another Mapping already holds under this Activity Type (one Mapping per Activity Type + Category).
  const clashMessage = (activityType, cats) => {
    const taken = cats.filter((p) => db.mappings.some((mm) => mm.activityType === activityType && (mm.category || []).includes(p) && mm.id !== editingId));
    if (!taken.length) return "";
    const pairs = taken.map((p) => `${activityType} \u00B7 ${p}`);
    return `${pairs.length === 1 ? pairs[0] : pairs.slice(0, -1).join(", ") + " and " + pairs[pairs.length - 1]} already ${pairs.length === 1 ? "exists" : "exist"}.`;
  };
  function changePt(v) {
    dirty();
    setPt(v);
    clearError("pt", "category");
    if (!v) {
      setCategory([]);
      setLinks({});
      return;
    }
    // The Categories and their Product Families move with the Mapping to the new Activity Type; a Category that is already taken there is flagged, not dropped.
    const allowed = CATEGORY_BY_ACTIVITY_TYPE[v] || [];
    const kept = category.filter((p) => allowed.includes(p));
    setCategory(kept);
    const msg = clashMessage(v, kept);
    if (msg) setErrors((e) => ({ ...e, category: msg }));
  }
  function toggleCategory(p) {
    dirty();
    clearError("category", `fam:${p}`);
    if (category.includes(p)) {
      setCategory(without(category, p));
      const l = { ...links };
      delete l[p];
      setLinks(l);
    } else {
      setCategory([...category, p]);
      setLinks({ ...links, [p]: [] });
    }
  }
  const toggleCategoryFamily = (p, f) => {
    dirty();
    clearError(`fam:${p}`);
    setLinks({ ...links, [p]: toggle(links[p] || [], f) });
  };
  const toggleT = (f) => {
    dirty();
    clearError("fam:T");
    setTFam(toggle(tFam, f));
  };
  const toggleX = (f) => {
    dirty();
    clearError("fam:X");
    setXFam(xFam.includes(f) ? [] : [f]);
  };
  const owners = (f, exclude) => ownershipLabels(db, f, { excludeCategory: exclude, editingId, formLinks: links });
  function saveDraft(name, products) {
    const res = validateFamily(allFamilies, name, products);
    if (res.errors) return res.errors;
    dirty();
    clearError(createCtx.category ? `fam:${createCtx.category}` : createCtx.forT ? "fam:T" : "fam:X");
    setDrafts([...drafts, { name: res.name, products: res.products }]);
    if (createCtx.category) setLinks({ ...links, [createCtx.category]: [...(links[createCtx.category] || []), res.name] });
    else if (createCtx.forT) setTFam([...tFam, res.name]);
    else if (createCtx.forX) setXFam([res.name]);
    setCreateCtx(null);
    return null;
  }
  async function save() {
    if (readOnly) return;
    let data;
    let used = [];
    const errs = {};
    if (!type) errs.type = "This is a required field.";
    else if (!effCode) errs.code = "This is a required field.";
    else if (taken(type, effCode)) errs.code = `${type} · ${effCode} already exists.`; // one Mapping each for T/X Default, X PREP, O EVAC, O AL and O AR
    if (isDefaultO) {
      if (!pt) errs.pt = "This is a required field.";
      else if (!category.length) errs.category = "This is a required field.";
      else if (clashMessage(pt, category)) errs.category = clashMessage(pt, category);
      category
        .filter((p) => !(links[p] || []).length)
        .forEach((p) => {
          errs[`fam:${p}`] = "This is a required field.";
        });
      used = [...new Set(category.flatMap((p) => links[p] || []))];
      data = {
        type,
        code,
        activityType: pt,
        category: [...category],
        links: Object.fromEntries(category.map((p) => [p, [...(links[p] || [])]])),
        families: used,
      };
    } else if (isTxDefault) {
      if (!tFam.length) errs["fam:T"] = "This is a required field.";
      used = [...tFam];
      data = { type, code: effCode, activityType: null, category: null, links: null, families: used };
    } else if (isPrep) {
      if (!xFam.length) errs["fam:X"] = "This is a required field.";
      used = [...xFam];
      data = { type, code, activityType: null, category: null, links: null, families: used };
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const usedDrafts = drafts.filter((d) => used.includes(d.name));
    const now = nowStamp();
    const buildNext = (d0) => {
      // Changing the Activity Type of a Type O Mapping moves the Schedule of each kept Category to its new Activity Type + Category row.
      const d =
        m && m.type === "O" && m.code === "Default" && isDefaultO && m.activityType !== pt
          ? { ...d0, activitySchedules: d0.activitySchedules.map((x) => (x.activityType === m.activityType && category.includes(x.category) ? { ...x, activityType: pt } : x)) }
          : d0;
      const families = [...d.families];
      usedDrafts.forEach((dr) => {
        if (!families.some((f) => f.name === dr.name)) families.push({ ...dr, createdAt: now, updatedAt: now });
      });
      let mappings,
        savedId,
        nextMappingId = d.nextMappingId;
      if (m) {
        savedId = m.id;
        mappings = d.mappings.map((x) => (x.id === m.id ? { ...x, ...data, updatedAt: now } : x));
      } else {
        savedId = nextMappingId++;
        mappings = [...d.mappings, { id: savedId, ...data, createdAt: now, updatedAt: now }];
      }
      // New Activity Type + Category rows show up in Schedule > Activity Type with the changed dot.
      const newFamilies = usedDrafts.map((dr) => dr.name).filter((n) => !d.families.some((f) => f.name === n)); // Product Families created with this Mapping get the changed dot too
      const next = {
        ...d,
        families,
        mappings,
        nextMappingId,
        changedMappings: withAdded(d.changedMappings, savedId),
        changedFamilies: [...new Set([...d.changedFamilies, ...newFamilies])],
      };
      const before = new Set(activityRows(d).map((r) => r.rowId));
      // Rows get the changed dot when they are new (also a Category moved to another Activity Type) or when their Product Families change.
      const familiesChanged = (p) => {
        const was = (m && m.type === "O" && m.code === "Default" && isDefaultO && m.activityType === pt && (m.links || {})[p]) || null;
        const now = links[p] || [];
        return !!was && (was.length !== now.length || !was.every((f) => now.includes(f)));
      };
      const rowIds = new Set(activityRows(next).map((r) => r.rowId));
      next.changedActivityRows = [
        ...new Set([
          ...d.changedActivityRows.filter((id) => rowIds.has(id)),
          ...[...rowIds].filter((id) => !before.has(id)),
          ...(isDefaultO ? category.filter(familiesChanged).map((p) => activityRowId(pt, p)) : []),
        ]),
      ];
      return pruneSchedule(next);
    };
    // Preview what this save would take out of Schedule (e.g. a Product Family unmapped from Type O while still scheduled).
    const removed = buildNext(db).removed;
    const removedFams = [...new Set(removed.map((r) => r.family))];
    const unmapped = removedFams.filter((f) => !used.includes(f)); // taken out of this Mapping
    const moved = removedFams.filter((f) => used.includes(f)); // still mapped, but its Type no longer fits where it's scheduled
    if (usedDrafts.length || removed.length) {
      const draftLine = usedDrafts.length ? (
        <p
          style={{ margin: 0 }}
        >{`${m ? "Updating" : "Creating"} this Mapping will also create new Product Family ${usedDrafts.map((d) => d.name).join(", ")}.`}</p>
      ) : null;
      const ok = await confirm(
        <>
          {draftLine}
          {removed.length ? (
            <>
              {unmapped.length ? (
                <p style={{ margin: draftLine ? "16px 0 0" : 0 }}>
                  {unmapped.length === 1
                    ? "Removing this Product Family from this Mapping will also remove it from Schedule."
                    : "Removing these Product Families from this Mapping will also remove them from Schedule."}
                </p>
              ) : null}
              {moved.length ? (
                <p style={{ margin: draftLine || unmapped.length ? "16px 0 0" : 0 }}>
                  {m && m.type === type && m.code === effCode
                    ? `Changing this Mapping will also remove ${moved.length === 1 ? "this Product Family" : "these Product Families"} from Schedule, which is set per Activity Type and Category.`
                    : `Moving ${moved.length === 1 ? "this Product Family" : "these Product Families"} to Type ${type}, Code ${effCode} will also remove ${moved.length === 1 ? "it" : "them"} from Schedule.`}
                </p>
              ) : null}
              <div style={{ marginTop: draftLine || unmapped.length || moved.length ? 16 : 0 }}>
                <RemovedSchedulePreview db={db} rows={removed} />
              </div>
              <UndoNote />
            </>
          ) : null}
        </>,
        { title: m ? "Update Mapping" : "Create Mapping", confirmLabel: m ? "Update" : "Create", wide: removed.length > 0 },
      );
      if (!ok) return;
    }
    setDb((d) => withTabDots(d, buildNext(d).db, fromTab));
    onDone();
    // Snackbar CTA: O · Default rows appear in Schedule > Activity Type; T/X · Default goes to Schedule > Unit. PREP is not scheduled.
    let cta = null;
    if (isDefaultO) {
      if (
        !(prefill && prefill.fromSchedule) &&
        category.some((p) => !db.activitySchedules.some((x) => x.category === p && (x.activityType === pt || (m && m.type === "O" && x.activityType === m.activityType))))
      )
        cta = { label: "Schedule for Activity Type", onClick: () => openSchedule("activity") };
    } else if (isTxDefault) {
      if (!(prefill && prefill.fromSchedule) && used.some((f) => !db.schedules.some((x) => x.family === f)))
        cta = { label: "Schedule for Unit", onClick: () => openSchedule("unit") };
    }
    // New Product Families created with this Mapping are named in the snackbar too.
    const createdPart = usedDrafts.length === 1 ? `Product Family ${usedDrafts[0].name}` : usedDrafts.length + " Product Families";
    const removedPart = removedFams.length
      ? `${removedFams.length === 1 ? removedFams[0] : removedFams.length + " Product Families"} removed from Schedule`
      : "";
    const done = !m
      ? usedDrafts.length
        ? `Mapping and ${createdPart} created.`
        : "Mapping created."
      : usedDrafts.length && removedPart
        ? `Mapping updated, ${createdPart} created and ${removedPart}.`
        : usedDrafts.length
          ? `Mapping updated and ${createdPart} created.`
          : removedPart
            ? `Mapping updated and ${removedPart}.`
            : "Mapping updated.";
    notify(done, cta, !m && isDefaultO ? 8000 : null); // a newly created O · Default Mapping: 8 s
  }
  function familyPicker({ key, legend, value, onToggle, onClear, exclude = null, activityType, createCtxValue, isSingle = false }) {
    return (
      <Section key={key} legend={legend}>
        <PickerField
          id={`fam-${key}`}
          options={familyNames}
          value={value}
          single={isSingle}
          onToggle={onToggle}
          onClear={onClear}
          getDisabled={(f) => f === FIXED_FAMILY || owners(f, exclude, activityType).length > 0}
          getSub={(f) => {
            if (f === FIXED_FAMILY) return "Mapped to respective units"; // Fixed Products belong to their Units, never to a Mapping
            const o = owners(f, exclude, activityType);
            return o.length ? `Mapped to: ${o.join(", ")}` : "";
          }}
          getDetail={productsOf}
          allowCreate
          onCreate={(term) => setCreateCtx({ ...createCtxValue, prefill: term })}
          error={errors[`fam:${key}`]}
        />
      </Section>
    );
  }
  let familySection;
  if (isDefaultO) {
    if (!pt) familySection = <div className="empty form-empty">Select all dropdown options to continue</div>;
    else if (!category.length) familySection = <div className="empty form-empty">Select all dropdown options to continue</div>;
    else
      familySection = category.map((p) =>
        familyPicker({
          key: p,
          legend: `Product Family mapped to ${p}`,
          value: links[p] || [],
          exclude: p,
          activityType: pt,
          onToggle: (f) => toggleCategoryFamily(p, f),
          onClear: () => {
            dirty();
            setLinks({ ...links, [p]: [] });
          },
          createCtxValue: { category: p },
        }),
      );
  } else if (isTxDefault) {
    familySection = familyPicker({
      key: "T",
      legend: "Product Family",
      value: tFam,
      onToggle: toggleT,
      onClear: () => {
        dirty();
        setTFam([]);
      },
      createCtxValue: { forT: true },
    });
  } else if (isSys) {
    // EVAC, AL and AR: one Products field per Category, from the FIXED Product Family. View only.
    familySection = category.map((p) => (
      <Section key={p} legend={`Products mapped to ${p}`}>
        <PickerField id={`fam-${p}`} placeholder="Product" options={fixedProducts} value={links[p] || []} disabled onToggle={() => {}} onClear={() => {}} />
      </Section>
    ));
  } else if (isPrep) {
    familySection = familyPicker({
      key: "X",
      legend: "Product Family",
      value: xFam.slice(0, 1),
      isSingle: true,
      onToggle: toggleX,
      onClear: () => {
        dirty();
        setXFam([]);
      },
      createCtxValue: { forX: true },
    });
  } else {
    familySection = <div className="empty form-empty">Select all dropdown options to continue</div>;
  }
  const familyInputShown = !!familySection && !(familySection.props && String(familySection.props.className || "").includes("form-empty"));
  const categoryOptions = isSys ? category : pt ? CATEGORY_BY_ACTIVITY_TYPE[pt] || [] : [];
  const categoryUsed = (p) => db.mappings.some((mm) => mm.activityType === pt && (mm.category || []).includes(p) && mm.id !== editingId);
  return (
    <>
      <div className="modal-body">
        <Section>
          <div className="grid4">
            <div className="field">
              <FieldLabel htmlFor="f-type">Type</FieldLabel>
              <SelectField
                id="f-type"
                placeholder="Type"
                value={type}
                onChange={setType}
                onClear={() => setType("")}
                error={errors.type}
                options={MAPPING_TYPES.map((t) => ({ value: t, disabled: typeTaken(t), hint: typeTaken(t) ? "Mapped" : "" }))}
              />
            </div>
            <div className="field">
              <FieldLabel htmlFor="f-code">Code</FieldLabel>
              <SelectField
                id="f-code"
                placeholder="Code"
                value={code}
                disabled={!type || type === "T/X"} // T/X has no Code to pick
                onChange={changeCode}
                onClear={() => changeCode("")}
                error={errors.code}
                options={(CODES_BY_TYPE[type] || []).map(codeOption)}
              />
            </div>
            <div className="field">
              <FieldLabel htmlFor="f-activityType">Activity Type</FieldLabel>
              <SelectField
                id="f-activityType"
                placeholder="Activity Type"
                value={pt}
                disabled={!isDefaultO || readOnly} // only O · Default picks an Activity Type; EVAC, AL and AR show theirs locked; T/X Default and X · PREP leave it empty
                clearable={isDefaultO}
                onChange={changePt}
                onClear={() => changePt("")}
                error={errors.pt}
                options={isDefaultO ? ACTIVITY_TYPES.map((p) => ({ value: p })) : pt ? [{ value: pt }] : []}
              />
            </div>
            <div className="field">
              <FieldLabel htmlFor="f-category">Category</FieldLabel>
              <PickerField
                key="category"
                id="f-category"
                placeholder="Category"
                uppercase={false}
                disabled={isSys || !isDefaultO || !pt}
                options={categoryOptions}
                value={category}
                onToggle={toggleCategory}
                onClear={() => {
                  dirty();
                  setCategory([]);
                  setLinks({});
                }}
                getDisabled={categoryUsed}
                getSub={(p) => {
                  if (!categoryUsed(p) || category.includes(p)) return "";
                  const other = db.mappings.find((mm) => mm.activityType === pt && (mm.category || []).includes(p) && mm.id !== editingId);
                  return other ? `Mapped to ${((other.links || {})[p] || []).join(", ")}` : "";
                }}
                error={errors.category}
              />
            </div>
          </div>
        </Section>
        {familySection}
      </div>
      <div className="modal-footer">
        <Button variant="primary" disabled={readOnly || !familyInputShown || (!!m && !mappingChanged)} onClick={save}>
          {m ? "Update" : "Create"}
        </Button>
        <Button variant="ghost" onClick={onDiscard}>
          Discard
        </Button>
        {m ? (
          <Button
            variant="dangerOutline"
            className="footer-delete"
            disabled={readOnly} // EVAC, AL and AR are system Mappings: they can be viewed but not updated or deleted
            title={readOnly ? "System Mapping can't be deleted" : undefined}
            onClick={async () => {
              if (await deleteMapping(editingId)) {
                dirtyRef.current = false;
                onDone();
              }
            }}
          >
            Delete
          </Button>
        ) : null}
      </div>
      <CreateFamilyDialog ctx={createCtx} onCancel={() => setCreateCtx(null)} onSave={saveDraft} />
    </>
  );
}
