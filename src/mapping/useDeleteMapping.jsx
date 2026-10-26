import { DeleteMappingPreview, UndoNote } from "../components/previews";
import { pruneSchedule } from "../lib/domain";
import { useDb, useUi } from "../components/common";
import { without } from "../lib/utils";

// Delete flow shared by the Mapping list (Delete icon) and Update Mapping (Delete button). Resolves true once the Mapping is deleted.
export function useDeleteMapping() {
  const { db, setDb } = useDb();
  const { confirm, notify } = useUi();
  return async function deleteMapping(id) {
    const m = db.mappings.find((x) => x.id === id);
    if (!m || m.system) return false; // system Mappings (EVAC, AL, AR) are never deleted
    // Schedule entries that only this Mapping allowed go with it.
    const afterDelete = (d) => ({ ...d, mappings: d.mappings.filter((x) => x.id !== id), changedMappings: without(d.changedMappings, id) });
    const { removed } = pruneSchedule(afterDelete(db));
    // The title names what is deleted.
    // A non-Default Code (X - PREP) is never scheduled, so its dialog has no Schedule line.
    const isCode = m.code !== "Default";
    const title = isCode ? `Delete Type ${m.type} - ${m.code} Mapping` : `Delete Type ${m.type} Mapping`;
    const ok = await confirm(
      <>
        {removed.length ? (
          <>
            <p style={{ margin: "0 0 16px" }}>Mapping is currently in use. Deleting this will also remove it from Schedule.</p>
            <DeleteMappingPreview db={db} m={m} removed={removed} />
          </>
        ) : (
          !isCode && <p style={{ margin: 0 }}>Mapping is not currently in use in Schedule. Deleting this will not affect Schedule.</p>
        )}
        <UndoNote />
      </>,
      { title, confirmLabel: "Delete", destructive: true, wide: !isCode },
    );
    if (!ok) return false;
    setDb((d) => pruneSchedule(afterDelete(d)).db);
    notify(removed.length ? "Mapping deleted and removed from Schedule" : "Mapping deleted");
    return true;
  };
}
